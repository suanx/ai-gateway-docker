// 服务状态缓存：healthAll 会真实请求各上游，不能每次访问都跑
// 60 秒 TTL，首页取缓存，后台再异步刷新

const { healthAll } = require('./proxy');

let cache = null;
let inflight = null;
const TTL = 60 * 1000;

function isFresh() {
  return cache && Date.now() - cache.at < TTL;
}

// 对外精简版：只暴露 label / 连通性 / 模型数，不含任何密钥信息
function publicSummary(info) {
  return {
    online: !!(info && info.any_available),
    total: (info && info.details ? info.details : []).length,
    working: (info && info.working_providers) || [],
    providers: ((info && info.details) || []).map((d) => ({
      id: d.provider,
      label: d.label,
      ready: !!d.available,
      models: typeof d.model_count === 'number' ? d.model_count : null,
    })),
    checked_at: new Date().toISOString(),
  };
}

async function refresh(cfg) {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const info = await healthAll(cfg);
      cache = { at: Date.now(), info, summary: publicSummary(info) };
    } catch (e) {
      // 出错也保留旧缓存，只是标记为过期
      if (!cache) cache = { at: 0, info: null, summary: publicSummary(null) };
    } finally {
      inflight = null;
    }
    return cache;
  })();
  await inflight;
  return cache;
}

async function getStatus(cfg) {
  if (!isFresh()) await refresh(cfg);
  else if (Date.now() - cache.at > TTL * 0.5) refresh(cfg).catch(() => {}); // 后台预热
  return cache.summary;
}

// 启动时预热一次
function warmup(cfg) {
  refresh(cfg).catch(() => {});
}

module.exports = { getStatus, refresh, warmup, publicSummary };
