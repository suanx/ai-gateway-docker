// 出站排队限流器
//
// 需求：上游有 RPM 上限（NVIDIA 40、LLM7 60、Groq 30），超了就返回 429，
// 编程工具（Cline / Roo Code）收到 429 轻则报错、重则任务中断。
//
// 做法：**排队而不是拒绝**。
// 每个上游维护一个「下一个可用时间槽」，请求来了先算要等多久，
// 睡过去再放行。客户端感受到的是「慢了一点」，而不是「失败了」。
//
// 关键实现细节：时间槽的推进必须和 sleep 串行化。若只在 sleep 之后
// 才推进 next，并发请求会同时读到同一个 next、算出同样的等待，
// 然后一起放行 —— 限流就失效了。所以这里在算出 slot 的瞬间就把
// next 往前推，并把整段逻辑挂在 promise 链上依次执行。

const MINUTE = 60000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 环境变量优先：RATE_NVIDIA_RPM=20 之类。0 = 不限。
function resolveRpm(p, id) {
  const env = process.env['RATE_' + String(id).toUpperCase() + '_RPM'];
  if (env !== undefined && env !== '') {
    const n = Number(env);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  const rl = p && p.rateLimit;
  if (rl && Number.isFinite(rl.rpm)) return Math.max(0, rl.rpm);
  return 0;
}

const limiters = new Map();

function getLimiter(id, rpm) {
  let l = limiters.get(id);
  // rpm 变化（改了环境变量）时重建，避免沿用旧的间隔
  if (!l || l.rpm !== rpm) {
    l = { rpm, next: 0, chain: Promise.resolve(), served: 0 };
    limiters.set(id, l);
  }
  return l;
}

// 排队等待放行。返回实际等待毫秒数（0 表示立即放行）。
async function acquire(id, p) {
  const rpm = resolveRpm(p, id);
  if (!rpm) return 0;

  const l = getLimiter(id, rpm);
  const interval = MINUTE / rpm; // 平滑间隔：40 RPM → 每 1.5s 放一个

  const run = async () => {
    const now = Date.now();
    // slot 可能落后于 now（空闲一段时间后），取 max 避免算出负等待
    const slot = Math.max(now, l.next);
    const wait = slot - now;
    // 关键：立刻推进，后面的请求排在本次之后
    l.next = slot + interval;
    l.served += 1;
    if (wait > 0) await sleep(wait);
    return wait;
  };

  // 挂在链尾，保证同一上游的槽位计算是串行的
  const task = l.chain.then(run, run);
  l.chain = task.catch(() => {}); // 单个请求失败不能断掉整条链
  return task;
}

// 给后台/调试用：看当前排队状态
function stats() {
  const out = {};
  for (const [id, l] of limiters) {
    out[id] = {
      rpm: l.rpm,
      served: l.served,
      // 还要等多久才有下一个空位（毫秒）
      pendingMs: Math.max(0, l.next - Date.now()),
    };
  }
  return out;
}

module.exports = { acquire, stats, resolveRpm, sleep };
