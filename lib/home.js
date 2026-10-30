// 首页：对外展示的服务状态 + 项目介绍（无密钥信息）
// 风格与后台一致：赛博科技风

function page(summary) {
  const init = JSON.stringify(summary || {});
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#05080f">
<title>AI Gateway · 服务状态</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#05080f; --panel:rgba(14,20,34,.62); --line:rgba(120,180,255,.14);
  --cy:#22d3ee; --mg:#a855f7; --gn:#34d399; --rd:#fb7185; --am:#fbbf24;
  --tx:#dbe6f5; --dim:#7c8ba3;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
  background:var(--bg);color:var(--tx);line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased;min-height:100%}

#bgfx{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.grid{position:absolute;inset:0;opacity:.16;
  background-image:linear-gradient(rgba(120,180,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,180,255,.16) 1px,transparent 1px);
  background-size:46px 46px;
  mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 20%,transparent 78%);
  -webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 20%,transparent 78%)}
.glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.3;animation:drift 22s ease-in-out infinite}
.g1{width:52vw;height:52vw;left:-14vw;top:-16vw;background:radial-gradient(circle,#0ea5e9,transparent 68%)}
.g2{width:46vw;height:46vw;right:-12vw;top:6vh;background:radial-gradient(circle,#a855f7,transparent 68%);animation-delay:-7s}
.g3{width:40vw;height:40vw;left:20vw;bottom:-18vw;background:radial-gradient(circle,#06b6d4,transparent 68%);animation-delay:-14s}
@keyframes drift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(4vw,3vh) scale(1.12)}66%{transform:translate(-3vw,-2vh) scale(.94)}}
.scan{position:absolute;left:0;right:0;height:180px;
  background:linear-gradient(180deg,transparent,rgba(34,211,238,.055),transparent);
  animation:scan 7s linear infinite}
@keyframes scan{0%{top:-180px}100%{top:100%}}

.wrap{position:relative;z-index:2;max-width:860px;margin:0 auto;padding:30px 16px 60px}

/* Hero */
header{text-align:center;margin-bottom:26px}
.mark{width:52px;height:52px;border-radius:14px;margin:0 auto 14px;position:relative;
  background:linear-gradient(135deg,rgba(34,211,238,.22),rgba(168,85,247,.22));
  border:1px solid rgba(34,211,238,.42);display:grid;place-items:center;
  box-shadow:0 0 26px rgba(34,211,238,.3),inset 0 0 18px rgba(34,211,238,.12)}
.mark::after{content:'';width:14px;height:14px;border-radius:3px;
  background:linear-gradient(135deg,var(--cy),var(--mg));box-shadow:0 0 14px var(--cy);
  animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.78)}}
.mark::before{content:'';position:absolute;inset:-7px;border-radius:18px;
  border:1px solid rgba(34,211,238,.2);animation:ring 3.2s ease-out infinite}
@keyframes ring{0%{transform:scale(.9);opacity:.7}100%{transform:scale(1.35);opacity:0}}
h1{font-size:28px;font-weight:800;letter-spacing:2px;
  background:linear-gradient(135deg,#67e8f9,#c4b5fd 55%,#f0abfc);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--dim);font-size:11.5px;letter-spacing:3px;margin-top:5px;text-transform:uppercase}

/* 状态条 */
.status{display:inline-flex;align-items:center;gap:9px;margin-top:16px;padding:8px 17px;
  border-radius:24px;font-size:13px;font-weight:600;letter-spacing:.5px;
  background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.32);color:#6ee7b7}
.status.down{background:rgba(251,113,133,.1);border-color:rgba(251,113,133,.32);color:#fda4af}
.sdot{width:8px;height:8px;border-radius:50%;background:var(--gn);
  box-shadow:0 0 10px var(--gn);animation:blink 2s ease-in-out infinite}
.status.down .sdot{background:var(--rd);box-shadow:0 0 10px var(--rd)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}

/* 卡片 */
.card{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:15px;
  padding:18px;margin-bottom:13px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  box-shadow:0 8px 34px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05);overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(34,211,238,.6),transparent);opacity:.65}
h2{font-size:12.5px;font-weight:700;letter-spacing:1.3px;color:#67e8f9;
  display:flex;align-items:center;gap:7px;margin-bottom:14px;text-transform:uppercase}
h2 .ic{width:19px;height:19px;border-radius:6px;display:grid;place-items:center;font-size:11px;
  background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.26)}
.h2r{margin-left:auto;font-size:10.5px;color:var(--dim);font-weight:400;letter-spacing:.3px}

/* 节点网格 */
.nodes{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:9px}
.node{background:rgba(255,255,255,.03);border:1px solid rgba(120,180,255,.1);
  border-radius:11px;padding:11px 12px;transition:border-color .2s,transform .2s}
.node:hover{border-color:rgba(34,211,238,.3);transform:translateY(-2px)}
.node .top{display:flex;align-items:center;gap:7px}
.dot{width:7px;height:7px;border-radius:50%;flex:none}
.d-on{background:var(--gn);box-shadow:0 0 8px var(--gn)}
.d-off{background:#48566d}
.node .nm{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.node .mt{font-size:10.5px;color:var(--dim);margin-top:5px;letter-spacing:.3px}
.node .mt b{color:#67e8f9;font-weight:600}

/* 接入信息 */
.kv{display:flex;justify-content:space-between;align-items:center;gap:10px;
  padding:9px 0;border-bottom:1px solid rgba(120,180,255,.09);font-size:13px}
.kv:last-child{border-bottom:none}
.kv b{color:var(--dim);font-weight:500;font-size:11.5px;letter-spacing:.5px;flex:none}
code{font-family:'SF Mono',Menlo,Consolas,monospace;background:rgba(34,211,238,.1);
  color:#67e8f9;padding:2.5px 8px;border-radius:6px;font-size:12px;word-break:break-all;text-align:right}
code.copy{cursor:pointer;transition:opacity .2s}
code.copy:active{opacity:.5}

/* 特性 */
.feat{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.f{background:rgba(255,255,255,.03);border:1px solid rgba(120,180,255,.1);border-radius:11px;padding:12px}
.f .t{font-size:12.5px;font-weight:600;color:#a5f3fc;margin-bottom:5px;display:flex;align-items:center;gap:6px}
.f .d{font-size:11.5px;color:var(--dim);line-height:1.6}
.tag{font-size:10px;padding:2px 7px;border-radius:5px;background:rgba(168,85,247,.14);
  color:#d8b4fe;border:1px solid rgba(168,85,247,.28)}

/* 按钮 */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  padding:10px 20px;border-radius:10px;border:none;cursor:pointer;text-decoration:none;
  font-size:13.5px;font-weight:600;letter-spacing:.4px;font-family:inherit;
  background:linear-gradient(135deg,#22d3ee,#a855f7);color:#fff;
  box-shadow:0 5px 18px rgba(34,211,238,.26);transition:transform .16s,box-shadow .16s}
.btn:active{transform:translateY(1px)}
.btn-g{background:rgba(255,255,255,.05);border:1px solid rgba(120,180,255,.2);
  color:#b8c7dc;box-shadow:none;font-weight:500}
.btns{display:flex;gap:9px;flex-wrap:wrap;margin-top:6px}

.foot{text-align:center;color:#48566d;font-size:10.5px;letter-spacing:1.2px;margin-top:22px}
.foot b{color:#67e8f9;font-weight:600}
.warn{margin-top:11px;background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.22);
  border-radius:10px;padding:10px 12px;font-size:11.5px;color:#fcd34d;line-height:1.65}

@media(max-width:520px){
  .wrap{padding:22px 12px 50px}
  h1{font-size:23px}
  .mark{width:44px;height:44px}
  .card{padding:15px}
  .nodes{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
  .feat{grid-template-columns:1fr}
}
</style>
</head>
<body>

<div id="bgfx">
  <div class="grid"></div>
  <div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
  <div class="scan"></div>
</div>

<div class="wrap">
<header>
  <div class="mark"></div>
  <h1>AI GATEWAY</h1>
  <div class="sub">Multi-Upstream Router</div>
  <div class="status" id="status"><span class="sdot"></span><span id="statusTxt">检测中…</span></div>
</header>

<div class="card">
  <h2><span class="ic">📡</span> 上游节点<span class="h2r" id="checkedAt"></span></h2>
  <div class="nodes" id="nodes"></div>
</div>

<div class="card">
  <h2><span class="ic">🔗</span> 接入信息</h2>
  <div class="kv"><b>Base URL</b><code class="copy" id="baseUrl" onclick="cp(this)"></code></div>
  <div class="kv"><b>模型</b><code class="copy" onclick="cp(this)">gpt-oss-120b</code></div>
  <div class="kv"><b>协议</b><code>OpenAI 兼容 · SSE 流式</code></div>
  <div class="warn">调用需携带 <b>ACCESS_KEY</b>（Bearer 方式）。管理后台与密钥配置不对外公开。</div>
</div>

<div class="card">
  <h2><span class="ic">⚡</span> 能力</h2>
  <div class="feat">
    <div class="f"><div class="t">🔄 自动降级</div><div class="d">上游 4xx / 5xx / 网络异常自动切换下一个节点，失败不中断</div></div>
    <div class="f"><div class="t">🌊 SSE 流式</div><div class="d">关闭缓冲与 gzip，逐字输出，适配编程工具与长对话</div></div>
    <div class="f"><div class="t">🧭 模型翻译</div><div class="d">统一别名自动转换为各上游真实模型 ID，无需记忆差异</div></div>
    <div class="f"><div class="t">⚙️ 请求规范化 <span class="tag">NEW</span></div><div class="d">自动适配各上游对 OpenAI 契约的偏离（如参数下限、字段类型）</div></div>
  </div>
</div>

<div class="card">
  <h2><span class="ic">🧭</span> 端点</h2>
  <div class="kv"><b>自动调度</b><code>/v1/chat/completions</code></div>
  <div class="kv"><b>指定上游</b><code>/&lt;provider&gt;/v1/chat/completions</code></div>
  <div class="kv"><b>健康检查</b><code>/healthz</code></div>
  <div class="btns">
    <a class="btn" href="/admin">进入控制台</a>
    <a class="btn btn-g" href="/healthz">查看 healthz</a>
  </div>
</div>

<div class="foot">AI GATEWAY · <b>DOCKER EDITION</b></div>
</div>

<script>
var INIT = __INIT__;
document.getElementById('baseUrl').textContent = location.origin + '/v1';

function cp(el){
  var t = el.textContent;
  if(navigator.clipboard) navigator.clipboard.writeText(t);
  var old = t; el.textContent = '已复制 ✓';
  setTimeout(function(){ el.textContent = old; }, 900);
}
function esc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function render(s){
  if(!s){ return; }
  var st = document.getElementById('status');
  var txt = document.getElementById('statusTxt');
  if(s.online){
    st.className = 'status';
    txt.textContent = '服务运行中 · ' + (s.working ? s.working.length : 0) + '/' + (s.total||0) + ' 节点可用';
  } else {
    st.className = 'status down';
    txt.textContent = '全部上游不可用';
  }
  if(s.checked_at){
    var d = new Date(s.checked_at);
    document.getElementById('checkedAt').textContent = '更新于 ' +
      d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }
  var box = document.getElementById('nodes');
  box.innerHTML = '';
  (s.providers || []).forEach(function(p){
    var d = document.createElement('div');
    d.className = 'node';
    d.innerHTML = '<div class="top"><span class="dot ' + (p.ready?'d-on':'d-off') + '"></span>'
      + '<span class="nm">' + esc(p.label) + '</span></div>'
      + '<div class="mt">' + (p.ready
          ? ('<b>' + (p.models!=null ? p.models + ' 个模型' : '在线') + '</b>')
          : '离线') + '</div>';
    box.appendChild(d);
  });
}
render(INIT);

// 异步刷新真实状态（不阻塞首屏）
fetch('/api/status').then(function(r){ return r.json(); })
  .then(function(s){ render(s); })
  .catch(function(){});
</script>
</body></html>`;

  // 注入服务端已缓存的状态，首屏无需等待请求
  return html.replace('__INIT__', init);
}

module.exports = { page };
