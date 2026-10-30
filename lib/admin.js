// 管理后台页面（单文件，零依赖）—— 赛博科技风
// 注意：整个模板用反引号包裹，内部任何 ${ 都已刻意规避（前端 JS 一律用字符串拼接）

function page() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#05080f">
<title>AI GATEWAY · 控制台</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#05080f; --panel:rgba(14,20,34,.62); --line:rgba(120,180,255,.14);
  --cy:#22d3ee; --mg:#a855f7; --gn:#34d399; --rd:#fb7185; --am:#fbbf24;
  --tx:#dbe6f5; --dim:#7c8ba3;
}
html,body{height:100%}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
  background:var(--bg); color:var(--tx); line-height:1.6; overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
}
/* ---------- 背景层 ---------- */
#bgfx{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
#bgfx canvas{position:absolute;inset:0;width:100%;height:100%}
.glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.32;animation:drift 22s ease-in-out infinite}
.g1{width:52vw;height:52vw;left:-14vw;top:-16vw;background:radial-gradient(circle,#0ea5e9,transparent 68%)}
.g2{width:46vw;height:46vw;right:-12vw;top:8vh;background:radial-gradient(circle,#a855f7,transparent 68%);animation-delay:-7s}
.g3{width:40vw;height:40vw;left:22vw;bottom:-18vw;background:radial-gradient(circle,#06b6d4,transparent 68%);animation-delay:-14s}
@keyframes drift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(4vw,3vh) scale(1.12)}66%{transform:translate(-3vw,-2vh) scale(.94)}}
.grid{position:absolute;inset:0;opacity:.16;
  background-image:linear-gradient(rgba(120,180,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(120,180,255,.16) 1px,transparent 1px);
  background-size:46px 46px;
  mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 20%,transparent 78%);
  -webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 20%,transparent 78%);}
.scan{position:absolute;left:0;right:0;height:180px;pointer-events:none;
  background:linear-gradient(180deg,transparent,rgba(34,211,238,.055),transparent);
  animation:scan 7s linear infinite}
@keyframes scan{0%{top:-180px}100%{top:100%}}

/* ---------- 布局 ---------- */
.wrap{position:relative;z-index:2;max-width:920px;margin:0 auto;padding:26px 15px 70px}

/* ---------- 头部 ---------- */
header{text-align:center;margin-bottom:22px;position:relative}
.brand{display:inline-flex;align-items:center;gap:11px;justify-content:center}
.mark{width:42px;height:42px;border-radius:12px;position:relative;flex:none;
  background:linear-gradient(135deg,rgba(34,211,238,.22),rgba(168,85,247,.22));
  border:1px solid rgba(34,211,238,.42);
  display:grid;place-items:center;
  box-shadow:0 0 22px rgba(34,211,238,.28),inset 0 0 16px rgba(34,211,238,.12)}
.mark::after{content:'';width:12px;height:12px;border-radius:3px;
  background:linear-gradient(135deg,var(--cy),var(--mg));
  box-shadow:0 0 12px var(--cy);animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.78)}}
.mark::before{content:'';position:absolute;inset:-6px;border-radius:16px;
  border:1px solid rgba(34,211,238,.2);animation:ring 3.2s ease-out infinite}
@keyframes ring{0%{transform:scale(.9);opacity:.7}100%{transform:scale(1.35);opacity:0}}
h1{font-size:25px;font-weight:800;letter-spacing:1.5px;
  background:linear-gradient(135deg,#67e8f9,#c4b5fd 55%,#f0abfc);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--dim);font-size:11.5px;letter-spacing:2.6px;margin-top:3px;text-transform:uppercase}
.chips{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:12px}
.chip{font-size:10.5px;letter-spacing:.6px;padding:4px 9px;border-radius:20px;
  background:rgba(34,211,238,.07);border:1px solid rgba(34,211,238,.2);color:#67e8f9}

/* ---------- 卡片 ---------- */
.card{position:relative;background:var(--panel);border:1px solid var(--line);
  border-radius:15px;padding:17px;margin-bottom:13px;
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  box-shadow:0 8px 34px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05);
  overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(34,211,238,.6),transparent);opacity:.65}
h2{font-size:12.5px;font-weight:700;letter-spacing:1.3px;color:#67e8f9;
  display:flex;align-items:center;gap:7px;margin-bottom:13px;text-transform:uppercase}
h2 .ic{width:19px;height:19px;border-radius:6px;display:grid;place-items:center;font-size:11px;
  background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.26)}

/* ---------- 状态表 ---------- */
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font-size:10px;letter-spacing:1.1px;color:var(--dim);
  padding:0 8px 8px;font-weight:600;text-transform:uppercase}
td{padding:9px 8px;border-top:1px solid rgba(120,180,255,.09);vertical-align:middle}
.pname{font-weight:600;font-size:13.5px}
.pdesc{display:block;font-size:10.5px;color:var(--dim);font-weight:400;margin-top:1px}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:middle}
.d-on{background:var(--gn);box-shadow:0 0 9px var(--gn);animation:blink 2.6s ease-in-out infinite}
.d-off{background:#48566d}
.d-anon{background:var(--cy);box-shadow:0 0 9px var(--cy)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.45}}
.badge{font-size:10px;padding:2.5px 7px;border-radius:5px;letter-spacing:.4px;white-space:nowrap}
.b-ok{background:rgba(52,211,153,.14);color:#6ee7b7;border:1px solid rgba(52,211,153,.3)}
.b-no{background:rgba(251,113,133,.12);color:#fda4af;border:1px solid rgba(251,113,133,.28)}
.b-idle{background:rgba(124,139,163,.12);color:#94a3b8;border:1px solid rgba(124,139,163,.24)}

/* ---------- 表单 ---------- */
label{display:block;font-size:11px;color:var(--dim);margin-bottom:5px;letter-spacing:.5px}
input,select,textarea{width:100%;background:rgba(5,9,17,.72);border:1px solid rgba(120,180,255,.16);
  border-radius:10px;padding:10px 12px;color:var(--tx);font-size:14px;font-family:inherit;
  transition:border-color .2s,box-shadow .2s}
input:focus,select:focus,textarea:focus{outline:none;border-color:rgba(34,211,238,.6);
  box-shadow:0 0 0 3px rgba(34,211,238,.1)}
input::placeholder{color:#4d5b73}
textarea{resize:vertical;min-height:78px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px;line-height:1.6}
select{appearance:none;-webkit-appearance:none;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,#67e8f9 50%),linear-gradient(135deg,#67e8f9 50%,transparent 50%);
  background-position:calc(100% - 17px) 51%,calc(100% - 12px) 51%;
  background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:34px}
.field{margin-bottom:11px}
.row{display:flex;gap:10px;flex-wrap:wrap}
.row>*{flex:1;min-width:150px}
.hint{font-size:10.5px;color:var(--dim);margin-top:4px}

/* ---------- 按钮 ---------- */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  padding:10px 20px;border-radius:10px;border:none;cursor:pointer;
  font-size:13.5px;font-weight:600;letter-spacing:.4px;font-family:inherit;
  background:linear-gradient(135deg,#22d3ee,#a855f7);color:#fff;
  box-shadow:0 5px 18px rgba(34,211,238,.26);transition:transform .16s,box-shadow .16s,opacity .16s}
.btn:active{transform:translateY(1px)}
.btn:hover{box-shadow:0 7px 24px rgba(34,211,238,.4)}
.btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.btn-g{background:rgba(255,255,255,.05);border:1px solid rgba(120,180,255,.2);
  color:#b8c7dc;box-shadow:none;font-weight:500}
.btn-g:hover{background:rgba(255,255,255,.09);box-shadow:none}
.btns{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:5px}

/* ---------- 终端输出 ---------- */
.term{background:#03060d;border:1px solid rgba(120,180,255,.14);border-radius:11px;
  overflow:hidden;margin-top:12px}
.term-bar{display:flex;align-items:center;gap:6px;padding:7px 11px;
  background:rgba(120,180,255,.05);border-bottom:1px solid rgba(120,180,255,.1)}
.term-bar i{width:9px;height:9px;border-radius:50%;display:block}
.term-bar i:nth-child(1){background:#fb7185}.term-bar i:nth-child(2){background:#fbbf24}.term-bar i:nth-child(3){background:#34d399}
.term-bar span{margin-left:6px;font-size:10.5px;color:var(--dim);letter-spacing:1px;font-family:'SF Mono',Menlo,monospace}
#out{padding:13px;min-height:96px;max-height:340px;overflow-y:auto;white-space:pre-wrap;
  word-break:break-word;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12.5px;
  line-height:1.75;color:#a7f3d0}
#out:empty::before{content:'// 等待请求…';color:#3f4c63}
.cur{display:inline-block;width:7px;height:14px;background:var(--cy);
  vertical-align:text-bottom;animation:blink 1.1s step-end infinite}
.meta{display:flex;gap:7px;flex-wrap:wrap;font-size:11px;color:var(--dim);margin-top:9px;align-items:center}
.meta span{background:rgba(255,255,255,.04);padding:3.5px 9px;border-radius:6px;
  border:1px solid rgba(120,180,255,.1)}
.ok{color:#6ee7b7}.bad{color:#fda4af}

/* ---------- 接入信息 ---------- */
.kv{display:flex;justify-content:space-between;align-items:center;gap:10px;
  padding:9px 0;border-bottom:1px solid rgba(120,180,255,.09);font-size:13px}
.kv:last-child{border-bottom:none}
.kv b{color:var(--dim);font-weight:500;font-size:11.5px;letter-spacing:.5px;flex:none}
code{font-family:'SF Mono',Menlo,Consolas,monospace;background:rgba(34,211,238,.1);
  color:#67e8f9;padding:2.5px 7px;border-radius:6px;font-size:12px;
  word-break:break-all;text-align:right}
.copy{cursor:pointer;transition:opacity .2s}
.copy:active{opacity:.5}

/* ---------- 提示条 ---------- */
.warn{display:flex;gap:8px;background:rgba(251,191,36,.07);
  border:1px solid rgba(251,191,36,.22);border-radius:10px;padding:10px 12px;
  font-size:11.5px;color:#fcd34d;line-height:1.65;margin-top:11px}
.warn b{color:#fde68a}

/* ---------- 登录 ---------- */
#login{max-width:344px;margin:14vh auto 0;position:relative;z-index:2}
#login .field{margin-bottom:14px}
#login h2{justify-content:center;font-size:13px;margin-bottom:16px}

/* ---------- 页脚 ---------- */
.foot{text-align:center;color:#48566d;font-size:10.5px;letter-spacing:1.2px;margin-top:24px}
.foot b{color:#67e8f9;font-weight:600}

/* ---------- 移动端 ---------- */
@media(max-width:520px){
  .wrap{padding:18px 11px 56px}
  h1{font-size:21px}
  .mark{width:36px;height:36px}
  .card{padding:14px;border-radius:13px}
  .row>*{min-width:100%}
  table{font-size:12.5px}
  td{padding:8px 5px}
  .pdesc{font-size:10px}
  .btn{padding:9px 16px;font-size:13px}
}
</style>
</head>
<body>

<div id="bgfx">
  <canvas id="stars"></canvas>
  <div class="grid"></div>
  <div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
  <div class="scan"></div>
</div>

<div id="login" class="card">
  <h2><span class="ic">🔐</span> 身份验证</h2>
  <div class="field"><label>管理密码 ADMIN_PASSWORD</label>
    <input id="pw" type="password" autocomplete="current-password" placeholder="输入后台密码"></div>
  <button class="btn" style="width:100%" onclick="doLogin()">进入控制台</button>
  <div class="warn" id="loginErr" style="display:none"></div>
</div>

<div id="main" class="wrap" style="display:none">

<header>
  <div class="brand">
    <div class="mark"></div>
    <div style="text-align:left">
      <h1>AI GATEWAY</h1>
      <div class="sub">Multi-Upstream Router</div>
    </div>
  </div>
  <div class="chips">
    <span class="chip">GROQ</span><span class="chip">LLM7</span><span class="chip">KILO</span>
    <span class="chip">NVIDIA</span><span class="chip">POLLINATIONS</span><span class="chip">AI HORDE</span>
  </div>
</header>

<div class="card">
  <h2><span class="ic">📡</span> 上游节点</h2>
  <table>
    <tr><th>节点</th><th>配置</th><th>连通</th></tr>
    <tbody id="statusTable"></tbody>
  </table>
  <div class="btns">
    <button class="btn btn-g" onclick="loadHealth()">重新探测</button>
    <span id="orderInfo" style="font-size:11px;color:var(--dim)"></span>
  </div>
</div>

<div class="card">
  <h2><span class="ic">🔑</span> 密钥配置</h2>
  <div class="row">
    <div class="field"><label>Groq API Key</label><input id="groq_key" placeholder="gsk_... 留空则跳过"></div>
    <div class="field"><label>LLM7 Key</label><input id="llm7_key" placeholder="留空=匿名模式"></div>
  </div>
  <div class="row">
    <div class="field"><label>NVIDIA Key</label><input id="nvidia_key" placeholder="nvapi-... 留空则跳过"></div>
    <div class="field"><label>Kilo Key（可选）</label><input id="kilo_key" placeholder="匿名已够用"></div>
  </div>
  <div class="row">
    <div class="field"><label>Pollinations Key（可选）</label><input id="pollinations_key" placeholder="匿名已够用"></div>
    <div class="field"><label>AI Horde Key（可选）</label><input id="aihorde_key" placeholder="留空=匿名 0000000000"></div>
  </div>
  <div class="row">
    <div class="field"><label>网关访问密码 ACCESS_KEY</label><input id="access_key" placeholder="客户端调用时校验"></div>
    <div class="field"><label>管理密码 ADMIN_PASSWORD</label><input id="admin_password" type="password" placeholder="登录本后台用"></div>
  </div>
  <div class="field"><label>调度优先级（逗号分隔，慢速排最后）</label>
    <input id="provider_order" placeholder="groq,llm7,kilo,nvidia,pollinations,aihorde"></div>
  <div class="btns">
    <button class="btn" onclick="saveConfig()">保存配置</button>
    <span id="saveMsg" style="font-size:12.5px"></span>
  </div>
  <div class="warn"><span>⚠</span><div>已配置的 Key 显示为打码值，<b>不改就保持原样</b>。要清空某项请输入一个空格后保存。留空表示跳过该上游（匿名档除外）。</div></div>
</div>

<div class="card">
  <h2><span class="ic">🧪</span> 在线调试</h2>
  <div class="row">
    <div class="field" style="margin-bottom:0"><label>端点</label>
      <select id="route">
        <option value="/v1/chat/completions">/v1 · 自动调度</option>
        <option value="/groq/v1/chat/completions">/groq · 强制 Groq</option>
        <option value="/llm7/v1/chat/completions">/llm7 · 强制 LLM7</option>
        <option value="/kilo/v1/chat/completions">/kilo · 强制 Kilo</option>
        <option value="/nvidia/v1/chat/completions">/nvidia · 强制 NVIDIA</option>
        <option value="/pollinations/v1/chat/completions">/pollinations · 强制 Pollinations</option>
        <option value="/aihorde/v1/chat/completions">/aihorde · 强制 AI Horde</option>
      </select></div>
    <div class="field" style="margin-bottom:0"><label>模型</label><input id="model" value="gpt-oss-120b"></div>
  </div>
  <div class="row" style="margin-top:11px">
    <div class="field" style="margin-bottom:0"><label>模式</label>
      <select id="stream"><option value="true">流式 SSE</option><option value="false">完整返回</option></select></div>
    <div class="field" style="margin-bottom:0"><label>&nbsp;</label>
      <button class="btn btn-g" style="width:100%" onclick="clearOut()">清空输出</button></div>
  </div>
  <div class="field" style="margin-top:11px"><label>消息内容</label>
    <textarea id="msg">用一句话介绍你自己</textarea></div>
  <button class="btn" id="sendBtn" onclick="send()">发送请求</button>

  <div class="term">
    <div class="term-bar"><i></i><i></i><i></i><span>OUTPUT</span></div>
    <div id="out"></div>
  </div>
  <div class="meta" id="testMeta"></div>
</div>

<div class="card">
  <h2><span class="ic">🔗</span> 客户端接入</h2>
  <div class="kv"><b>Base URL</b><code class="copy" id="baseUrl" onclick="cp(this)"></code></div>
  <div class="kv"><b>API Key</b><code class="copy" id="apiKeyHint" onclick="cp(this)"></code></div>
  <div class="kv"><b>模型</b><code class="copy" onclick="cp(this)">gpt-oss-120b</code></div>
  <div class="warn"><span>💡</span><div>编程工具（Cline / Roo Code / Continue）需要 <b>tool calling</b>，请务必配置 <b>Groq 或 NVIDIA</b>。AI Horde 明确不支持函数调用，仅作兜底。</div></div>
</div>

<div class="foot">AI GATEWAY · <b>DOCKER EDITION</b> · DATA /app/data/config.json</div>
</div>

<script>
var TOKEN = localStorage.getItem('gw_token') || '';
var FIELDS = ['groq_key','llm7_key','nvidia_key','kilo_key','pollinations_key','aihorde_key','access_key','admin_password','provider_order'];

/* ---------- 星空粒子 ---------- */
(function(){
  var c = document.getElementById('stars'), x = c.getContext('2d'), ps = [], w, h;
  function init(){
    w = c.width = window.innerWidth; h = c.height = window.innerHeight;
    ps = [];
    var n = Math.min(90, Math.floor(w*h/16000));
    for(var i=0;i<n;i++) ps.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.3+.3,
      a:Math.random()*.5+.15,s:Math.random()*.16+.03,d:Math.random()*6.28});
  }
  function draw(){
    x.clearRect(0,0,w,h);
    for(var i=0;i<ps.length;i++){
      var p = ps[i];
      p.d += .012; p.y -= p.s;
      if(p.y < -4){ p.y = h+4; p.x = Math.random()*w; }
      var tw = .55 + .45*Math.sin(p.d);
      x.beginPath(); x.arc(p.x,p.y,p.r,0,6.283);
      x.fillStyle = 'rgba(140,200,255,'+(p.a*tw)+')'; x.fill();
    }
    requestAnimationFrame(draw);
  }
  init(); draw();
  window.addEventListener('resize', init);
})();

/* ---------- 工具 ---------- */
function api(path, opts){
  return fetch(path, Object.assign({headers:{'Content-Type':'application/json','X-Gateway-Token':TOKEN}}, opts||{}));
}
function esc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function cp(el){
  var t = el.textContent;
  if(navigator.clipboard) navigator.clipboard.writeText(t);
  var old = el.textContent; el.textContent = '已复制 ✓';
  setTimeout(function(){ el.textContent = old; }, 900);
}
function clearOut(){ document.getElementById('out').innerHTML=''; }

/* ---------- 登录 ---------- */
async function doLogin(){
  var pw = document.getElementById('pw').value;
  var r = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({password:pw})});
  var j = await r.json();
  if(j.ok){
    TOKEN = j.token; localStorage.setItem('gw_token', TOKEN);
    document.getElementById('login').style.display='none';
    document.getElementById('main').style.display='block';
    boot();
  } else {
    var e = document.getElementById('loginErr');
    e.style.display='flex'; e.textContent = j.error || '登录失败';
  }
}
function logout(){ localStorage.removeItem('gw_token'); location.reload(); }

/* ---------- 启动 ---------- */
async function boot(){
  document.getElementById('baseUrl').textContent = location.origin + '/v1';
  await loadConfig(); await loadHealth();
}

async function loadConfig(){
  var r = await api('/api/config');
  if(r.status===401){ logout(); return; }
  var j = await r.json();
  FIELDS.forEach(function(f){
    var el = document.getElementById(f);
    if(el && f!=='admin_password') el.value = j[f] || '';
  });
  document.getElementById('apiKeyHint').textContent = j.access_key_set ? '你的 ACCESS_KEY' : '任意值（未设密码）';
}

async function loadHealth(){
  var r = await api('/api/health');
  if(r.status===401){ logout(); return; }
  var j = await r.json();
  var tb = document.getElementById('statusTable');
  tb.innerHTML = '';
  (j.details||[]).forEach(function(d){
    var unconfigured = (d.note === '未配置 Key');
    var cfg = unconfigured
      ? '<span class="dot d-off"></span><span style="color:var(--dim);font-size:11.5px">未配置</span>'
      : '<span class="dot d-anon"></span><span style="font-size:11.5px">已就绪</span>';
    var conn;
    if(unconfigured) conn = '<span class="badge b-idle">跳过</span>';
    else if(d.available) conn = '<span class="badge b-ok">✓ '+d.http_status+'</span>';
    else conn = '<span class="badge b-no">✗ '+(d.http_status||'ERR')+'</span>';
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><span class="pname">'+esc(d.label)+'</span><span class="pdesc">'+esc(d.note||'')+'</span></td>'
      + '<td>'+cfg+'</td><td>'+conn+'</td>';
    tb.appendChild(tr);
  });
  document.getElementById('orderInfo').textContent = '调度：' + (j.provider_order||[]).join(' → ');
}

async function saveConfig(){
  var payload = {};
  FIELDS.forEach(function(f){
    var el = document.getElementById(f);
    if(el) payload[f] = el.value;
  });
  var r = await api('/api/config',{method:'POST',body:JSON.stringify(payload)});
  var j = await r.json();
  var m = document.getElementById('saveMsg');
  m.textContent = j.ok ? '✓ 已保存，立即生效' : ('✗ '+(j.error||'保存失败'));
  m.className = j.ok ? 'ok' : 'bad';
  if(j.ok) setTimeout(loadHealth, 500);
}

/* ---------- 调试请求 ---------- */
async function send(){
  var out = document.getElementById('out'), btn = document.getElementById('sendBtn');
  var route = document.getElementById('route').value;
  var model = document.getElementById('model').value.trim();
  var text = document.getElementById('msg').value;
  var useStream = document.getElementById('stream').value === 'true';
  out.innerHTML = ''; btn.disabled = true; btn.textContent = '请求中…';
  var t0 = Date.now();
  try{
    var resp = await api(route,{method:'POST',body:JSON.stringify({
      model:model, messages:[{role:'user',content:text}], stream:useStream})});
    var provider = resp.headers.get('X-Upstream-Provider') || '-';
    var fb = resp.headers.get('X-Fallback-Log');
    if(!resp.ok){
      var t = await resp.text();
      out.textContent = 'HTTP ' + resp.status + '\n\n' + t;
      setMeta('<span>状态：<b class="bad">'+resp.status+'</b></span>');
      btn.disabled=false; btn.textContent='发送请求'; return;
    }
    if(!useStream){
      var j = await resp.json();
      var c = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '(空响应)';
      out.textContent = c;
      setMeta('<span>状态：<b class="ok">200</b></span><span>节点：<b>'+esc(provider)+'</b></span><span>耗时：'+(Date.now()-t0)+'ms</span>');
      btn.disabled=false; btn.textContent='发送请求'; return;
    }
    var reader = resp.body.getReader(), dec = new TextDecoder(), buf = '', acc = '';
    while(true){
      var rd = await reader.read();
      if(rd.done) break;
      buf += dec.decode(rd.value,{stream:true});
      var lines = buf.split('\n'); buf = lines.pop();
      for(var i=0;i<lines.length;i++){
        var line = lines[i].trim();
        if(!line || line.indexOf('data:') !== 0) continue;
        var d = line.slice(5).trim();
        if(!d || d === '[DONE]') continue;
        try{
          var o = JSON.parse(d);
          var dl = o.choices && o.choices[0] && o.choices[0].delta;
          if(dl && dl.content){
            acc += dl.content;
            out.textContent = acc;
            out.scrollTop = out.scrollHeight;
          }
        }catch(e){}
      }
    }
    if(!acc) out.textContent = '(未解析到内容，该模型可能只输出思维链)';
    var m = '<span>状态：<b class="ok">200</b></span><span>节点：<b>'+esc(provider)+'</b></span>'
      + '<span>耗时：'+(Date.now()-t0)+'ms</span>';
    if(fb) m += '<span>降级：'+esc(decodeURIComponent(fb).slice(0,90))+'</span>';
    setMeta(m);
  }catch(e){
    out.textContent = '请求失败：' + e.message;
    setMeta('<span class="bad">网络错误</span>');
  }
  btn.disabled=false; btn.textContent='发送请求';
}
function setMeta(h){ document.getElementById('testMeta').innerHTML = h; }

/* ---------- 异常处理：任何错误都显示在页面上，避免纯黑无提示 ---------- */
function showErr(msg){
  var d = document.getElementById('jsErr');
  if(!d){
    d = document.createElement('div');
    d.id = 'jsErr';
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999;'
      + 'background:#7f1d1d;color:#fecaca;padding:10px 13px;font-size:12px;'
      + 'font-family:Menlo,Consolas,monospace;line-height:1.6;word-break:break-all';
    document.body.appendChild(d);
  }
  d.textContent = 'JS 错误：' + msg;
}
window.onerror = function(m, src, line){
  showErr(m + ' @line ' + line);
  return false;
};
window.addEventListener('unhandledrejection', function(e){
  showErr('Promise 未捕获：' + ((e.reason && e.reason.message) || e.reason));
});

/* ---------- 入口 ---------- */
// 登录框默认可见（HTML 里不再 display:none），JS 出错时至少能看到它
function showMain(){
  document.getElementById('login').style.display = 'none';
  document.getElementById('main').style.display = 'block';
}
if(TOKEN){
  // 乐观显示，验证失败再退回登录（最多 reload 一次，不会死循环）
  showMain();
  boot();
} else {
  document.getElementById('login').style.display = 'block';
}
// 3 秒兜底：若两个容器都没显示（极端情况），强制显示登录框
setTimeout(function(){
  var l = document.getElementById('login'), m = document.getElementById('main');
  if(l && m && l.style.display !== 'block' && m.style.display !== 'block'){
    l.style.display = 'block';
    showErr('初始化超时，已回退到登录页');
  }
}, 3000);
document.getElementById('pw').addEventListener('keydown', function(e){
  if(e.key === 'Enter') doLogin();
});
</script>
</body></html>`;
}

module.exports = { page };
