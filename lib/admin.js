// 管理后台页面（单文件，零依赖）
// 注意：模板字符串内的 ${} 均已转义，避免被 Node 解析

function page() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI 网关管理</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
background:#0a0e1a;color:#e6edf3;line-height:1.6;min-height:100vh;
background-image:radial-gradient(circle at 20% 20%,rgba(34,211,238,.12),transparent 50%),radial-gradient(circle at 80% 60%,rgba(168,85,247,.10),transparent 50%)}
.wrap{max-width:960px;margin:0 auto;padding:36px 20px 60px}
header{text-align:center;margin-bottom:30px}
.logo{font-size:38px;font-weight:800;letter-spacing:-1px;
background:linear-gradient(135deg,#22d3ee,#a855f7);-webkit-background-clip:text;background-clip:text;color:transparent}
.tagline{color:#8b98a8;margin-top:6px;font-size:14px}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
border-radius:14px;padding:20px;margin-bottom:16px;backdrop-filter:blur(10px)}
h2{font-size:16px;margin-bottom:12px;color:#22d3ee;display:flex;align-items:center;gap:8px}
table{width:100%;border-collapse:collapse;font-size:14px}
td,th{padding:8px 9px;text-align:left;border-bottom:1px solid rgba(255,255,255,.07)}
th{color:#8b98a8;font-weight:600;font-size:12px}
code{font-family:'SF Mono',Menlo,Consolas,monospace;background:rgba(34,211,238,.12);
color:#67e8f9;padding:2px 6px;border-radius:5px;font-size:12.5px}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:7px}
.dot-on{background:#4ade80;box-shadow:0 0 8px #4ade80}
.dot-off{background:#64748b}
.dot-anon{background:#38bdf8;box-shadow:0 0 8px #38bdf8}
input,select,textarea{width:100%;background:#070b14;border:1px solid rgba(255,255,255,.13);
border-radius:9px;padding:9px 11px;color:#e6edf3;font-size:14px;font-family:inherit}
input:focus,select:focus,textarea:focus{outline:none;border-color:#22d3ee}
textarea{resize:vertical;min-height:80px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px}
label{display:block;font-size:12.5px;color:#8b98a8;margin-bottom:5px}
.field{margin-bottom:12px}
.btn{display:inline-block;padding:9px 18px;border-radius:9px;border:none;cursor:pointer;
font-size:14px;font-weight:600;background:linear-gradient(135deg,#22d3ee,#a855f7);color:#fff}
.btn:hover{opacity:.85}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-ghost{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#c9d4e0}
.row{display:flex;gap:10px;flex-wrap:wrap}
.row>*{flex:1;min-width:160px}
#out{background:#070b14;border:1px solid rgba(255,255,255,.09);border-radius:10px;
padding:14px;min-height:110px;white-space:pre-wrap;font-size:13px;line-height:1.7;
font-family:'SF Mono',Menlo,Consolas,monospace;color:#c9d4e0;max-height:380px;overflow-y:auto}
.meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:#8b98a8;margin-top:10px}
.meta span{background:rgba(255,255,255,.05);padding:4px 9px;border-radius:6px}
.ok{color:#4ade80}.bad{color:#f87171}
#login{display:none;max-width:380px;margin:60px auto}
.foot{text-align:center;color:#64748b;font-size:12px;margin-top:26px}
.warn{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);
border-radius:9px;padding:11px;font-size:12.5px;color:#fbbf24;margin-top:11px}
</style>
</head>
<body>

<div id="login" class="card">
  <h2>🔐 登录管理后台</h2>
  <div class="field"><label>管理密码（ADMIN_PASSWORD）</label>
    <input id="pw" type="password" autocomplete="current-password"></div>
  <button class="btn" onclick="doLogin()">登录</button>
  <div class="warn" id="loginErr" style="display:none"></div>
</div>

<div id="main" class="wrap" style="display:none">
<header>
  <div class="logo">AI 网关管理</div>
  <div class="tagline">Groq · LLM7 · Kilo · NVIDIA 四上游 · 自动降级</div>
</header>

<div class="card">
  <h2>📡 上游状态</h2>
  <table id="statusTable"><tr><th>上游</th><th>配置</th><th>连通</th><th>说明</th></tr></table>
  <div class="meta" style="margin-top:12px">
    <button class="btn btn-ghost" onclick="loadHealth()">🔄 重新检测</button>
    <span id="orderInfo"></span>
  </div>
</div>

<div class="card">
  <h2>🔑 密钥配置</h2>
  <div class="row">
    <div class="field"><label>Groq Key (gsk_...)</label><input id="groq_key" placeholder="留空=跳过该上游"></div>
    <div class="field"><label>LLM7 Key</label><input id="llm7_key" placeholder="留空=匿名模式"></div>
  </div>
  <div class="row">
    <div class="field"><label>Kilo Key（可选）</label><input id="kilo_key" placeholder="匿名已够用"></div>
    <div class="field"><label>NVIDIA Key (nvapi-...)</label><input id="nvidia_key" placeholder="留空=跳过"></div>
  </div>
  <div class="row">
    <div class="field"><label>网关访问密码 ACCESS_KEY</label><input id="access_key" placeholder="客户端调用时用（建议设）"></div>
    <div class="field"><label>管理密码 ADMIN_PASSWORD</label><input id="admin_password" type="password" placeholder="登录本后台用"></div>
  </div>
  <div class="field"><label>上游优先级</label>
    <input id="provider_order" placeholder="groq,llm7,kilo,nvidia"></div>
  <button class="btn" onclick="saveConfig()">💾 保存配置</button>
  <span id="saveMsg" style="margin-left:10px;font-size:13px"></span>
  <div class="warn">留空表示跳过该上游（匿名档除外）。已配置的 Key 显示为打码值，<b>不改就保持原样</b>，要清空请输入一个空格后保存。</div>
</div>

<div class="card">
  <h2>🧪 在线测试</h2>
  <div class="row">
    <div class="field" style="margin-bottom:0"><label>端点</label>
      <select id="route">
        <option value="/v1/chat/completions">/v1 自动选上游</option>
        <option value="/groq/v1/chat/completions">/groq/v1 强制 Groq</option>
        <option value="/llm7/v1/chat/completions">/llm7/v1 强制 LLM7</option>
        <option value="/kilo/v1/chat/completions">/kilo/v1 强制 Kilo</option>
        <option value="/nvidia/v1/chat/completions">/nvidia/v1 强制 NVIDIA</option>
      </select></div>
    <div class="field" style="margin-bottom:0"><label>模型</label><input id="model" value="gpt-oss-120b"></div>
    <div class="field" style="margin-bottom:0"><label>模式</label>
      <select id="stream"><option value="true">流式</option><option value="false">非流式</option></select></div>
  </div>
  <div class="field" style="margin-top:12px"><label>消息</label>
    <textarea id="msg">用一句话介绍你自己</textarea></div>
  <button class="btn" id="sendBtn" onclick="send()">发送</button>
  <button class="btn btn-ghost" onclick="document.getElementById('out').textContent=''">清空</button>
  <div id="out" style="margin-top:12px">等待请求…</div>
  <div class="meta" id="testMeta"></div>
</div>

<div class="card">
  <h2>🔗 客户端接入</h2>
  <table>
    <tr><td>Base URL</td><td><code id="baseUrl"></code></td></tr>
    <tr><td>API Key</td><td><code id="apiKeyHint"></code></td></tr>
    <tr><td>模型</td><td><code>gpt-oss-120b</code>（或 <code>auto</code>）</td></tr>
  </table>
  <div class="warn">建议把 <code>provider_order</code> 设为 <code>llm7,groq,kilo,nvidia</code> 稳定性优先；追求速度则用 <code>groq,llm7,nvidia,kilo</code>。</div>
</div>

<div class="foot">AI Gateway Docker · 数据保存在 /app/data/config.json</div>
</div>

<script>
var TOKEN = localStorage.getItem('gw_token') || '';

function api(path, opts){
  return fetch(path, Object.assign({headers:{'Content-Type':'application/json','X-Gateway-Token':TOKEN}}, opts||{}));
}

async function doLogin(){
  var pw = document.getElementById('pw').value;
  var r = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
  var j = await r.json();
  if(j.ok){
    TOKEN = j.token;
    localStorage.setItem('gw_token', TOKEN);
    document.getElementById('login').style.display='none';
    document.getElementById('main').style.display='block';
    boot();
  } else {
    var e=document.getElementById('loginErr');
    e.style.display='block'; e.textContent = j.error || '登录失败';
  }
}

async function boot(){
  document.getElementById('baseUrl').textContent = location.origin + '/v1';
  await loadConfig();
  await loadHealth();
}

async function loadConfig(){
  var r = await api('/api/config');
  if(r.status===401){ logout(); return; }
  var j = await r.json();
  ['groq_key','llm7_key','kilo_key','nvidia_key','access_key','provider_order'].forEach(function(f){
    var el=document.getElementById(f); if(el) el.value = j[f]||'';
  });
  document.getElementById('apiKeyHint').textContent = j.access_key_set ? '你的 ACCESS_KEY' : '随意填（未设密码）';
  document.getElementById('orderInfo').textContent = '调度顺序：' + (j.provider_order||'');
}

async function loadHealth(){
  var r = await api('/api/health');
  if(r.status===401){ logout(); return; }
  var j = await r.json();
  var tb=document.getElementById('statusTable');
  tb.innerHTML = '<tr><th>上游</th><th>配置</th><th>连通</th><th>说明</th></tr>';
  (j.details||[]).forEach(function(d){
    var cfgDot = d.available===false && d.note==='未配置 Key' ? '<span class="dot dot-off"></span>未配置'
      : '<span class="dot dot-on"></span>已配置';
    var conn = d.available ? '<span class="ok">✓ '+d.http_status+'</span>'
      : (d.note==='未配置 Key' ? '<span class="bad">—</span>' : '<span class="bad">✗ '+(d.http_status||d.error||'')+'</span>');
    var tr=document.createElement('tr');
    tr.innerHTML = '<td><b>'+d.label+'</b></td><td>'+cfgDot+'</td><td>'+conn+'</td><td style="color:#8b98a8;font-size:12.5px">'+(d.note||'')+'</td>';
    tb.appendChild(tr);
  });
}

async function saveConfig(){
  var payload = {};
  ['groq_key','llm7_key','kilo_key','nvidia_key','access_key','admin_password','provider_order'].forEach(function(f){
    var el=document.getElementById(f); if(el) payload[f]=el.value;
  });
  var r = await api('/api/config',{method:'POST',body:JSON.stringify(payload)});
  var j = await r.json();
  var m=document.getElementById('saveMsg');
  m.textContent = j.ok ? '✓ 已保存，立即生效' : ('✗ '+(j.error||'保存失败'));
  m.className = j.ok ? 'ok' : 'bad';
  if(j.ok) setTimeout(loadHealth, 500);
}

async function send(){
  var out=document.getElementById('out'), btn=document.getElementById('sendBtn');
  var route=document.getElementById('route').value;
  var model=document.getElementById('model').value.trim();
  var text=document.getElementById('msg').value;
  var useStream=document.getElementById('stream').value==='true';
  out.textContent=''; btn.disabled=true; btn.textContent='请求中…';
  var t0=Date.now();
  try{
    var resp = await api(route,{
      method:'POST',
      body: JSON.stringify({model:model,messages:[{role:'user',content:text}],stream:useStream})
    });
    var provider = resp.headers.get('X-Upstream-Provider')||'-';
    var fb = resp.headers.get('X-Fallback-Log');
    if(!resp.ok){
      var t = await resp.text();
      out.textContent = 'HTTP '+resp.status+'\\n\\n'+t;
      setMeta('状态：<b class="bad">'+resp.status+'</b>');
      btn.disabled=false; btn.textContent='发送'; return;
    }
    if(!useStream){
      var j=await resp.json();
      out.textContent=(j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'(空)';
      setMeta('状态：<b class="ok">200</b>'); 
      btn.disabled=false; btn.textContent='发送'; return;
    }
    var reader=resp.body.getReader(), dec=new TextDecoder(), buf='', acc='';
    while(true){
      var rd=await reader.read(); if(rd.done) break;
      buf += dec.decode(rd.value,{stream:true});
      var lines=buf.split('\\n'); buf=lines.pop();
      for(var i=0;i<lines.length;i++){
        var line=lines[i].trim();
        if(!line || line.indexOf('data:')!==0) continue;
        var d=line.slice(5).trim();
        if(!d || d==='[DONE]') continue;
        try{
          var o=JSON.parse(d);
          var dl=o.choices&&o.choices[0]&&o.choices[0].delta;
          if(dl&&dl.content){acc+=dl.content;out.textContent=acc;out.scrollTop=out.scrollHeight;}
        }catch(e){}
      }
    }
    if(!acc) out.textContent='(未解析到内容)';
    var m='<span>状态：<b class="ok">200</b></span><span>上游：<b>'+provider+'</b></span><span>耗时：'+(Date.now()-t0)+'ms</span>';
    if(fb) m+='<span>降级记录：'+decodeURIComponent(fb).slice(0,100)+'</span>';
    setMetaHtml(m);
  }catch(e){
    out.textContent='请求失败：'+e.message;
    setMeta('<span class="bad">网络错误</span>');
  }
  btn.disabled=false; btn.textContent='发送';
}
function setMeta(h){document.getElementById('testMeta').innerHTML=h;}
function setMetaHtml(h){document.getElementById('testMeta').innerHTML=h;}
function logout(){localStorage.removeItem('gw_token');location.reload();}

// 启动
if(TOKEN){
  api('/api/config').then(function(r){
    if(r.status===401){ document.getElementById('login').style.display='block'; }
    else { document.getElementById('main').style.display='block'; boot(); }
  }).catch(function(){ document.getElementById('login').style.display='block'; });
} else {
  document.getElementById('login').style.display='block';
}
</script>
</body></html>`;
}

module.exports = { page };
