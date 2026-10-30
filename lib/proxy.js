// 转发核心：模型翻译 → 多上游自动降级 → SSE 流式透传
const { Readable } = require('stream');
const {
  PROVIDERS,
  mapModel,
  upstreamAuth,
  isAvailable,
  providerOrder,
  normalizeBody,
} = require('./providers');

// HTTP 头只接受 Latin-1，中文等需转义
function safeHeader(s) {
  try {
    return encodeURIComponent(String(s)).slice(0, 400);
  } catch (e) {
    return 'unprintable';
  }
}

const HOP = [
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'access-control-allow-origin',
  'access-control-allow-headers',
];

// ---- SSE 心跳 ----
// 作用：流式响应在「上游还在思考/排队、尚未吐出第一个 token」的静默期，
// 定时发一个 SSE 注释行保活，避免被 CDN（如 Cloudflare 100s）、
// Nginx、NAT 防火墙或移动网络切换判定为空闲连接而掐断。
//
// 间隔取 15s：远小于各类中间件常见的 60~100s 空闲阈值，
// 又不至于产生过多无谓流量。可用 HEARTBEAT_MS 环境变量覆盖。
const HEARTBEAT_MS = Math.max(1000, Number(process.env.HEARTBEAT_MS || 15000));

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    ...extra,
  };
}

function jsonError(res, message, status = 500, code = 'error', extra = {}) {
  const body = JSON.stringify({ error: { message, type: code, code } });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...cors(),
    ...extra,
  });
  res.end(body);
}

// 带心跳的流式泵
//
// 为什么不直接 pipe：pipe 期间若上游长时间不发数据（模型思考、排队、
// 检索增强等），整条链路完全静默，中间设备会按「空闲超时」切断连接。
// 这里在静默达到阈值时插入 `: ping` 注释行——SSE 规范里冒号开头是注释，
// 客户端会忽略，但字节确实在链路上流动，连接就被认为是活跃的。
//
// 保活之外还顺手做一件事：立刻写一个 `: open` 注释把响应头冲刷出去。
// 部分代理（含 Nginx 默认配置）会攒够缓冲区才下发首个包，
// 这一字节能强制触发 flush，让客户端马上进入「已连接」状态。
function pumpStream(res, body, heartbeatMs) {
  return new Promise((resolve) => {
    const src = Readable.fromWeb(body);
    let timer = null;
    let closed = false;

    const stop = () => {
      if (closed) return;
      closed = true;
      if (timer) clearInterval(timer);
      timer = null;
    };

    // 每次收到真实数据就重置静默计时：有数据流动就不需要心跳
    const arm = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (closed || res.writableEnded || res.destroyed) return stop();
        try {
          res.write(': ping\n\n');
        } catch (e) {
          return stop();
        }
      }, heartbeatMs);
    };

    src.on('data', (chunk) => {
      arm(); // 有数据 → 重置静默窗口
      if (res.writableEnded || res.destroyed) return;
      res.write(chunk);
    });

    src.on('end', () => {
      stop();
      if (!res.writableEnded && !res.destroyed) res.end();
      resolve();
    });

    src.on('error', () => {
      stop();
      if (!res.writableEnded && !res.destroyed) res.end();
      resolve();
    });

    // 客户端断开（Cline 取消、浏览器关页面）时反向停止读取上游，
    // 否则上游还在推数据而下游已消失，会白白消耗额度
    res.on('close', () => {
      stop();
      if (typeof src.destroy === 'function') src.destroy();
      resolve();
    });

    try {
      res.write(': open\n\n'); // 冲刷响应头
    } catch (e) {}
    arm();
  });
}

// 单次尝试
async function attempt(p, cfg, upstreamPath, bodyObj, incomingAuth, method) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'User-Agent': 'AI-Gateway-Docker/1.0',
  };
  const auth = upstreamAuth(p, cfg, incomingAuth);
  if (auth) headers['Authorization'] = auth;
  if (bodyObj && bodyObj.stream) headers['Accept'] = 'text/event-stream';

  const init = { method, headers };
  if (method !== 'GET' && method !== 'HEAD' && bodyObj) {
    init.body = JSON.stringify(bodyObj);
  }

  let r;
  try {
    r = await fetch(p.base + upstreamPath, init);
  } catch (e) {
    return { ok: false, status: 0, error: String((e && e.message) || e) };
  }

  if (r.ok) return { ok: true, res: r };

  let detail = '';
  try {
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('event-stream')) detail = (await r.text()).slice(0, 200);
  } catch (e) {}
  return { ok: false, status: r.status, error: detail || `HTTP ${r.status}` };
}

// 主入口：带降级转发
// preBody：框架（如 Fastify）已解析好的请求体。给了就不再读原始流，
// 避免「流已被消费 → 重试时拿到空 body」这个经典坑。
async function proxy(req, res, cfg, upstreamPath, forced, preBody) {
  const method = req.method;

  // 取 body（重试时复用同一份）
  let bodyObj = null;
  if (method !== 'GET' && method !== 'HEAD') {
    if (preBody !== undefined) {
      // 已由框架解析：可能是对象、字符串或 Buffer
      if (preBody === null || preBody === '') {
        bodyObj = null;
      } else if (typeof preBody === 'string') {
        try {
          bodyObj = JSON.parse(preBody);
        } catch (e) {
          return jsonError(res, '请求体不是合法 JSON', 400, 'bad_request');
        }
      } else if (Buffer.isBuffer(preBody)) {
        if (preBody.length) {
          try {
            bodyObj = JSON.parse(preBody.toString('utf-8'));
          } catch (e) {
            return jsonError(res, '请求体不是合法 JSON', 400, 'bad_request');
          }
        }
      } else {
        bodyObj = preBody; // 已是对象
      }
    } else {
      // 回退：从原始流读（node:http 直连场景）
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (raw) {
        try {
          bodyObj = JSON.parse(raw);
        } catch (e) {
          return jsonError(res, '请求体不是合法 JSON', 400, 'bad_request');
        }
      }
    }
  }

  const incomingAuth = req.headers['authorization'] || '';
  const order = providerOrder(cfg, forced);
  const log = [];
  // 只有客户端显式要 stream 才走心跳泵；普通 JSON 请求不需要保活
  const isStreamReq = !!(bodyObj && bodyObj.stream === true);

  for (const name of order) {
    const p = PROVIDERS[name];
    if (!isAvailable(p, cfg)) {
      log.push({ provider: name, skipped: '未配置 Key' });
      continue;
    }

    // 模型名翻译 + 上游请求体规范化（如 AI Horde 的 max_tokens/stop/tools 约束）
    const payload = normalizeBody(
      bodyObj && bodyObj.model ? { ...bodyObj, model: mapModel(bodyObj.model, p) } : bodyObj,
      p
    );

    let r = await attempt(p, cfg, upstreamPath, payload, incomingAuth, method);

    // 模型不存在 → 用该上游默认模型重试一次
    if (!r.ok && r.status === 404 && payload && payload.model && payload.model !== p.defaultModel) {
      log.push({ provider: name, status: 404, retryWith: p.defaultModel });
      r = await attempt(
        p,
        cfg,
        upstreamPath,
        { ...payload, model: p.defaultModel },
        incomingAuth,
        method
      );
    }

    if (r.ok) {
      const h = {};
      r.res.headers.forEach((v, k) => {
        if (!HOP.includes(k.toLowerCase())) h[k] = v;
      });
      Object.assign(h, cors({ 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' }));
      h['X-Upstream-Provider'] = name;
      if (log.length) h['X-Fallback-Log'] = safeHeader(JSON.stringify(log));

      res.writeHead(r.res.status, h);
      if (r.res.body) {
        // 流式（SSE）用带心跳的泵，非流式直接 pipe 即可
        const ct = (r.res.headers.get('content-type') || '').toLowerCase();
        if (isStreamReq && ct.includes('event-stream')) {
          await pumpStream(res, r.res.body, HEARTBEAT_MS);
        } else {
          Readable.fromWeb(r.res.body).pipe(res);
        }
      } else {
        res.end();
      }
      return;
    }

    log.push({ provider: name, status: r.status || 'network_error', error: r.error });
  }

  const msg = `全部上游均失败。${log.map((l) => `[${l.provider}] ${l.error || l.skipped || ''}`).join(' ')}`;
  jsonError(res, msg, 502, 'all_upstreams_failed', {
    'X-Fallback-Log': safeHeader(JSON.stringify(log)),
  });
}

// 连通性自检（后台/healthz/首页 用）
async function healthAll(cfg) {
  const jobs = Object.keys(PROVIDERS).map(async (name) => {
    const p = PROVIDERS[name];
    const t0 = Date.now();
    if (!isAvailable(p, cfg)) {
      return { provider: name, label: p.label, available: false, note: '未配置 Key' };
    }
    try {
      const headers = { Accept: 'application/json' };
      const auth = upstreamAuth(p, cfg, '');
      if (auth) headers['Authorization'] = auth;
      const r = await fetch(p.base + '/models', { headers });
      const text = await r.text();
      // 顺带数一下模型数量，首页展示用
      let model_count = null;
      try {
        const j = JSON.parse(text);
        if (j && Array.isArray(j.data)) model_count = j.data.length;
      } catch (e) {}
      return {
        provider: name,
        label: p.label,
        available: r.ok,
        http_status: r.status,
        elapsed_ms: Date.now() - t0,
        model_count: model_count,
        note: r.ok ? '可用' : '不可用（地区封锁或 Key 无效）',
        body_preview: text.slice(0, 150),
      };
    } catch (e) {
      return {
        provider: name,
        label: p.label,
        available: false,
        error: String((e && e.message) || e),
        note: '连接异常',
      };
    }
  });
  const details = await Promise.all(jobs);
  const ok = details.filter((d) => d.available).map((d) => d.provider);
  return {
    any_available: ok.length > 0,
    working_providers: ok,
    provider_order: providerOrder(cfg, null),
    note: ok.length ? `可用上游：${ok.join(', ')}` : '无可用上游',
    details,
  };
}

module.exports = { proxy, healthAll, jsonError, cors, safeHeader };
