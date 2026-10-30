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
async function proxy(req, res, cfg, upstreamPath, forced) {
  const method = req.method;

  // 读 body（重试时复用）
  let bodyObj = null;
  if (method !== 'GET' && method !== 'HEAD') {
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

  const incomingAuth = req.headers['authorization'] || '';
  const order = providerOrder(cfg, forced);
  const log = [];

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
        Readable.fromWeb(r.res.body).pipe(res);
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
