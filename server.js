// AI 网关 Docker 版 —— 主服务
// 零依赖，纯 Node 内置模块。管理后台 :/admin，OpenAI 兼容接口 :/v1/*
const http = require('http');
const { URL } = require('url');
const store = require('./lib/store');
const { proxy, healthAll, jsonError, cors } = require('./lib/proxy');
const { page: adminPage } = require('./lib/admin');
const { page: homePage } = require('./lib/home');
const status = require('./lib/status');
const { PROVIDERS } = require('./lib/providers');

const cfg0 = store.load();
const PORT = Number(process.env.PORT || 3002);

// ---- 鉴权 ----
// 管理接口：有 ADMIN_PASSWORD 则校验 token；未设密码时放行（页面会警告）
function adminAuthed(req) {
  const pw = store.get().admin_password;
  if (!pw) return true;
  const t = req.headers['x-gateway-token'];
  return store.validSession(t);
}

// 业务接口：配了 ACCESS_KEY 则校验；后台登录态也算通过
function apiAuthed(req) {
  const ak = store.get().access_key;
  if (!ak) return true;
  const auth = req.headers['authorization'] || '';
  if (auth === `Bearer ${ak}`) return true;
  return store.validSession(req.headers['x-gateway-token']);
}

// ---- 路由 ----
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = u.pathname;

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors());
    res.end();
    return;
  }

  // 健康检查（无需认证）
  if (path === '/healthz') {
    const info = await healthAll(store.get());
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...cors() });
    res.end(JSON.stringify(info, null, 2));
    return;
  }

  // 管理后台页面
  // 未设 ADMIN_PASSWORD 时直接在页面里下发 token，免去登录请求（避免登录按钮无响应）
  if (path === '/admin' || path === '/admin/') {
    const preToken = store.get().admin_password ? '' : store.createSession();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...cors() });
    res.end(adminPage(preToken));
    return;
  }

  // 公开状态（首页用，不含任何密钥信息）
  if (path === '/api/status') {
    const s = await status.getStatus(store.get());
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...cors() });
    res.end(JSON.stringify(s));
    return;
  }

  // 根路径 → 服务状态首页（不再直接跳后台登录）
  if (path === '/') {
    const s = await status.getStatus(store.get());
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...cors() });
    res.end(homePage(s));
    return;
  }

  // ---- 管理 API ----
  if (path === '/api/login') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    } catch (e) {}
    const pw = store.get().admin_password;
    if (!pw) {
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors() });
      res.end(JSON.stringify({ ok: true, token: store.createSession() }));
      return;
    }
    if (body.password === pw) {
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors() });
      res.end(JSON.stringify({ ok: true, token: store.createSession() }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json', ...cors() });
      res.end(JSON.stringify({ ok: false, error: '密码错误' }));
    }
    return;
  }

  if (path === '/api/config') {
    if (!adminAuthed(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', ...cors() });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors() });
      res.end(JSON.stringify(store.masked()));
      return;
    }
    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...cors() });
        res.end(JSON.stringify({ ok: false, error: 'bad json' }));
        return;
      }
      const merged = store.mergeUpdate(body);
      const ok = store.save(merged);
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors() });
      res.end(JSON.stringify({ ok }));
      return;
    }
  }

  if (path === '/api/health') {
    if (!adminAuthed(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', ...cors() });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    const info = await healthAll(store.get());
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors() });
    res.end(JSON.stringify(info));
    return;
  }

  // ---- 业务代理 ----
  const forcedMatch = path.match(/^\/(groq|llm7|kilo|nvidia|pollinations|aihorde)\/v1(\/.*)?$/);
  if (forcedMatch || path.startsWith('/v1/')) {
    if (!apiAuthed(req)) {
      jsonError(res, 'Unauthorized：ACCESS_KEY 不正确', 401, 'auth_error');
      return;
    }
    let forced = null;
    let upstreamPath = path;
    if (forcedMatch) {
      forced = forcedMatch[1];
      upstreamPath = forcedMatch[2] || '/';
    } else {
      upstreamPath = path.slice('/v1'.length);
    }
    await proxy(req, res, store.get(), upstreamPath, forced);
    return;
  }

  jsonError(res, '路径不存在。可用：/admin、/healthz、/v1/*', 404, 'not_found');
});

// 预热状态缓存，首页首屏直接有数据
status.warmup(cfg0);

server.listen(PORT, '0.0.0.0', () => {
  const c = store.get();
  const set = Object.keys(PROVIDERS).filter((k) => c[k + '_key']);
  console.log(`[gateway] 监听 :${PORT}`);
  console.log(`[gateway] 管理后台 http://localhost:${PORT}/admin`);
  console.log(`[gateway] 已配置上游: ${set.length ? set.join(', ') : '(无，匿名档仍可用)'}`);
  console.log(`[gateway] 调度顺序: ${c.provider_order}`);
  if (!c.admin_password) console.warn('[gateway] ⚠ 未设 ADMIN_PASSWORD，后台任何人可访问');
  if (!c.access_key) console.warn('[gateway] ⚠ 未设 ACCESS_KEY，接口任何人可调');
});
