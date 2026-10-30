// AI 网关 Docker 版 —— 主服务
// Fastify + EJS 服务端渲染。管理后台 :/admin，OpenAI 兼容接口 :/v1/*
//
// 为什么换成 Fastify + EJS：
// 之前用「手搓模板字符串 + 客户端 JS 决定显隐」，反复出 bug——
// 反引号与 ${} 转义冲突、JS 一出错页面就全黑或按钮无响应。
// 现在模板是真正的 .ejs 文件，显隐由服务端渲染决定，浏览器拿到的就是终态 HTML。

const path = require('path');
const Fastify = require('fastify');
const store = require('./lib/store');
const { proxy, healthAll, jsonError, cors } = require('./lib/proxy');
const status = require('./lib/status');
const { PROVIDERS } = require('./lib/providers');

const cfg0 = store.load();
const PORT = Number(process.env.PORT || 3002);
const HOST = process.env.HOST || '0.0.0.0';

const NO_STORE = 'no-store, no-cache, must-revalidate, max-age=0';

const fastify = Fastify({
  logger: false,
  // 编程工具会发很大的上下文，默认 1MB 不够
  bodyLimit: 64 * 1024 * 1024,
  // 代理自己处理 404，保持原有 OpenAI 风格错误体
  frameworkErrors: null,
});

// ---- 请求体解析 ----
// 目标：拿到「能原样转发给上游」的 body，同时让管理接口拿到对象。
// JSON 解析成功给对象；失败则保留原始 Buffer，交给 proxy 统一报错（OpenAI 风格）。
fastify.removeAllContentTypeParsers();
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  function (req, body, done) {
    if (!body || !body.length) return done(null, null);
    try {
      done(null, JSON.parse(body.toString('utf-8')));
    } catch (e) {
      // 不抛错，交给业务层给出 OpenAI 风格的错误响应
      done(null, body);
    }
  }
);
fastify.addContentTypeParser('*', { parseAs: 'buffer' }, function (req, body, done) {
  done(null, body);
});

// ---- 模板引擎 ----
fastify.register(require('@fastify/view'), {
  engine: { ejs: require('ejs') },
  root: path.join(__dirname, 'views'),
  defaultContext: { encode: false },
});

// ---- 鉴权 ----
// 管理接口：有 ADMIN_PASSWORD 则校验 token；未设密码时放行（页面会警告）
function adminAuthed(req) {
  const pw = store.get().admin_password;
  if (!pw) return true;
  return store.validSession(req.headers['x-gateway-token']);
}

// 业务接口：配了 ACCESS_KEY 则校验；后台登录态也算通过
function apiAuthed(req) {
  const ak = store.get().access_key;
  if (!ak) return true;
  const auth = req.headers['authorization'] || '';
  if (auth === `Bearer ${ak}`) return true;
  return store.validSession(req.headers['x-gateway-token']);
}

// ---- CORS 预检 ----
fastify.addHook('onRequest', async (request, reply) => {
  if (request.method === 'OPTIONS') {
    reply.code(204).headers(cors()).send();
    return reply;
  }
});

// ---- 健康检查（无需认证）----
fastify.get('/healthz', async (request, reply) => {
  const info = await healthAll(store.get());
  reply.code(200).headers({ 'Content-Type': 'application/json; charset=utf-8', ...cors() });
  return typeof info === 'string' ? info : JSON.stringify(info, null, 2);
});

// ---- 服务状态首页 ----
fastify.get('/', async (request, reply) => {
  const s = await status.getStatus(store.get());
  reply.headers({
    'Cache-Control': NO_STORE,
    ...cors(),
  });
  return reply.view('home.ejs', { summary: s });
});

// ---- 公开状态 API（不含任何密钥信息）----
fastify.get('/api/status', async (request, reply) => {
  const s = await status.getStatus(store.get());
  reply.headers({ 'Content-Type': 'application/json; charset=utf-8', ...cors() });
  return JSON.stringify(s);
});

// ---- 管理后台 ----
// 未设 ADMIN_PASSWORD 时服务端直接渲染后台并下发 token，
// 浏览器拿到就是终态 HTML，不依赖任何客户端 JS。
const adminHandler = async (request, reply) => {
  const noPw = !store.get().admin_password;
  const preToken = noPw ? store.createSession() : '';
  reply.headers({
    'Cache-Control': NO_STORE,
    ...cors(),
  });
  return reply.view('admin.ejs', { preToken, authed: noPw });
};
fastify.route({ method: 'GET', url: '/admin', handler: adminHandler });
fastify.route({ method: 'GET', url: '/admin/', handler: adminHandler });

// ---- 登录 ----
fastify.post('/api/login', async (request, reply) => {
  let body = {};
  const raw = request.body;
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) body = raw;
  else if (Buffer.isBuffer(raw) && raw.length) {
    try {
      body = JSON.parse(raw.toString('utf-8'));
    } catch (e) {}
  }

  const pw = store.get().admin_password;
  reply.headers({ 'Content-Type': 'application/json; charset=utf-8', ...cors() });
  if (!pw || body.password === pw) {
    return JSON.stringify({ ok: true, token: store.createSession() });
  }
  reply.code(401);
  return JSON.stringify({ ok: false, error: '密码错误' });
});

// ---- 配置读写 ----
const configHandler = async (request, reply) => {
  if (!adminAuthed(request.raw)) {
    reply.code(401).headers({ 'Content-Type': 'application/json; charset=utf-8', ...cors() });
    return JSON.stringify({ error: 'unauthorized' });
  }
  reply.headers({ 'Content-Type': 'application/json; charset=utf-8', ...cors() });

  if (request.method === 'GET') return JSON.stringify(store.masked());

  // POST
  let body = {};
  const raw = request.body;
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) body = raw;
  else if (Buffer.isBuffer(raw) && raw.length) {
    try {
      body = JSON.parse(raw.toString('utf-8'));
    } catch (e) {
      reply.code(400);
      return JSON.stringify({ ok: false, error: 'bad json' });
    }
  }
  const merged = store.mergeUpdate(body);
  const ok = store.save(merged);
  return JSON.stringify({ ok });
};
fastify.get('/api/config', configHandler);
fastify.post('/api/config', configHandler);

// ---- 上游健康（后台用）----
fastify.get('/api/health', async (request, reply) => {
  if (!adminAuthed(request.raw)) {
    reply.code(401).headers({ 'Content-Type': 'application/json; charset=utf-8', ...cors() });
    return JSON.stringify({ error: 'unauthorized' });
  }
  const info = await healthAll(store.get());
  reply.headers({ 'Content-Type': 'application/json; charset=utf-8', ...cors() });
  return JSON.stringify(info);
});

// ---- 业务代理（含 SSE 流式）----
// 用 reply.hijack() 接管底层 socket，保证流式不被框架缓冲。
async function proxyHandler(request, reply) {
  if (!apiAuthed(request.raw)) {
    jsonError(reply.raw, 'Unauthorized：ACCESS_KEY 不正确', 401, 'auth_error');
    return reply;
  }

  const urlPath = request.url.split('?')[0];
  const forcedMatch = urlPath.match(
    /^\/(groq|llm7|kilo|nvidia|pollinations|aihorde)\/v1(\/.*)?$/
  );

  let forced = null;
  let upstreamPath = urlPath;
  if (forcedMatch) {
    forced = forcedMatch[1];
    // 上游白名单校验，防止通配路由放行非法 provider
    if (!VALID_PROVIDERS.includes(forced)) {
      jsonError(reply.raw, `未知上游：${forced}`, 404, 'not_found');
      return reply;
    }
    upstreamPath = forcedMatch[2] || '/';
  } else {
    upstreamPath = urlPath.slice('/v1'.length) || '/';
  }

  reply.hijack();
  await proxy(request.raw, reply.raw, store.get(), upstreamPath, forced, request.body);
  return reply;
}

const PROXY_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const VALID_PROVIDERS = Object.keys(PROVIDERS);

// /v1/* 自动调度；/<provider>/v1/* 强制指定上游
// 用字符串通配而非正则——find-my-way 对正则 URL 有限制。
const proxyRoutes = ['/v1', '/v1/*', '/:provider/v1', '/:provider/v1/*'];

for (const url of proxyRoutes) {
  fastify.route({ method: PROXY_METHODS, url, handler: proxyHandler });
}

// ---- 兜底 404（保持原有文案）----
fastify.setNotFoundHandler(async (request, reply) => {
  if (request.method === 'OPTIONS') return reply;
  reply.code(404).headers({ 'Content-Type': 'application/json; charset=utf-8', ...cors() });
  return JSON.stringify({
    error: {
      message: '路径不存在。可用：/admin、/healthz、/v1/*',
      type: 'not_found',
      code: 'not_found',
    },
  });
});

// ---- 启动 ----
// 预热状态缓存，首页首屏直接有数据
status.warmup(cfg0);

fastify
  .listen({ port: PORT, host: HOST })
  .then(() => {
    const c = store.get();
    const set = Object.keys(PROVIDERS).filter((k) => c[k + '_key']);
    console.log(`[gateway] 监听 :${PORT}`);
    console.log(`[gateway] 管理后台 http://localhost:${PORT}/admin`);
    console.log(`[gateway] 已配置上游: ${set.length ? set.join(', ') : '(无，匿名档仍可用)'}`);
    console.log(`[gateway] 调度顺序: ${c.provider_order}`);
    if (!c.admin_password) console.warn('[gateway] ⚠ 未设 ADMIN_PASSWORD，后台任何人可访问');
    if (!c.access_key) console.warn('[gateway] ⚠ 未设 ACCESS_KEY，接口任何人可调');
  })
  .catch((err) => {
    console.error('[gateway] 启动失败:', err);
    process.exit(1);
  });
