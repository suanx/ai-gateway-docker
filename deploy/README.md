# AI 网关 Docker 版 —— 宝塔面板部署说明

多上游 AI 网关（Groq / LLM7 / Kilo / NVIDIA / Pollinations / AI Horde）

> **技术栈**：Fastify 4 + EJS 3（服务端渲染）。
> 页面显隐、状态数据全部在服务端渲染完成，浏览器拿到的是终态 HTML——
> 不再依赖客户端 JS 决定显隐，杜绝「JS 出错导致页面全黑 / 按钮无响应」。，带 **Web 管理后台**，Docker 一键部署到 VPS。

- Fastify + EJS 服务端渲染，页面显隐在服务端决定，浏览器拿到即终态 HTML
- 管理后台 `/admin`：填 Key、看上游连通性、在线测试
- 配置存 `/app/data/config.json`（挂载卷），**重启不丢**
- OpenAI 协议兼容，改 `base_url` 即可对接
- SSE 流式透传，上游挂了自动降级

> 与 `suanx/groq-edgeone-proxy`（边缘函数版）的区别：那个跑在 Cloudflare/EdgeOne，适合翻译等短请求；这个跑在你自己的 VPS，无运行时限制，适合编程工具、长对话。

---

## 一、快速部署（宝塔终端，整段复制）

```bash
mkdir -p /opt/ai-gateway && cd /opt/ai-gateway

cat > docker-compose.yml <<'EOF'
services:
  ai-gateway:
    image: ghcr.io/suanx/ai-gateway:latest
    container_name: ai-gateway
    environment:
      PORT: 3002
      ADMIN_PASSWORD: 改成你的后台密码
      ACCESS_KEY: 改成你的接口密码
      PROVIDER_ORDER: llm7,groq,kilo,nvidia
    ports:
      - "127.0.0.1:3002:3002"
    volumes:
      - ai-gateway-data:/app/data
    restart: unless-stopped
volumes:
  ai-gateway-data:
EOF

docker compose up -d
curl http://127.0.0.1:3002/healthz
```

返回 JSON 即成功。`ADMIN_PASSWORD` 和 `ACCESS_KEY` **务必改成自己的**。

> 若镜像拉取失败，去 GitHub 仓库 → 右侧 Packages → ai-gateway → Package settings → Change visibility → **Public**。

---

## 二、宝塔建站点 + 反代

**① 网站 → 添加站点**
- 域名填你的
- **不要**勾选数据库 / FTP
- PHP 版本选**纯静态**

**② 终端放反代配置**（把 `你的域名` 替换掉）：

```bash
mkdir -p /www/server/panel/vhost/nginx/proxy/你的域名/
rm -f /www/server/panel/vhost/nginx/proxy/你的域名/*.conf
```

然后把仓库里 `deploy/nginx-proxy.conf` 的内容写入：

```
/www/server/panel/vhost/nginx/proxy/你的域名/ai-gateway.conf
```

**③ 检查并重载：**

```bash
nginx -t && systemctl reload nginx
```

> ⚠️ 常见坑：`rm -f *.conf` 这步不能省。宝塔面板「反向代理」点过一次就会生成一个带 `location /` 的文件，再放一个会报 `duplicate location "/"`。

**④ SSL**：站点 → SSL → Let's Encrypt → 申请 → 开**强制 HTTPS**

**⑤ 不放行 3002**：宝塔 → 安全 → 系统防火墙，只开 80 / 443 / SSH。

---

## 三、配置上游 Key

浏览器打开 `https://你的域名/admin`，用 `ADMIN_PASSWORD` 登录。

后台可以做四件事：

| 功能 | 说明 |
|---|---|
| **上游状态** | 实时显示四家是否配置、能否连通 |
| **密钥配置** | 填各家 Key，保存立即生效（不用重启） |
| **在线测试** | 选端点 + 模型发请求，看流式输出和命中的上游 |
| **优先级** | 调 `provider_order`，逗号分隔 |

> **关于 Keenable / Parallel**：这两个在 FreeLLMAPI 里是 `SearchOnlyProvider`，**只提供联网搜索，不提供聊天模型**，所以本网关没把它们当 LLM 上游。作为替代，加了 **Pollinations**（真匿名 LLM）和 **AI Horde**（真匿名 LLM）。

**Key 填写要点：**

- 留空 = 跳过该上游（LLM7 / Kilo 除外，它们匿名可用）
- 已填的显示为打码值，**不改就保持原样**
- 要清空某项，输入一个空格再保存

**建议优先级：**

| 场景 | 顺序 | 理由 |
|---|---|---|
| 稳定优先（推荐） | `llm7,groq,kilo,nvidia,pollinations,aihorde` | Groq 有地区封锁风险 |
| 速度优先 | `groq,llm7,nvidia,kilo,pollinations,aihorde` | Groq 最快 |

> **AI Horde 务必排最后**：它靠志愿者算力排队，单次可能几十秒到几分钟。放前面会拖慢正常请求。

---

## 四、客户端接入

```
Base URL: https://你的域名/v1
API  Key: 你的 ACCESS_KEY
模型:     gpt-oss-120b
```

| 工具 | 填法 |
|---|---|
| 沉浸式翻译 | 自定义 OpenAI 兼容，端点 `https://你的域名/v1/chat/completions` |
| Cline / Roo Code / Continue | OpenAI Compatible，填上面两项 |
| Cherry Studio | 添加 OpenAI 渠道，Base URL 填 `https://你的域名/v1` |
| 编程 Agent | 建议把 Nginx 超时调到 3600s（见 nginx-proxy.conf） |

**模型别名**（自动按上游翻译，也可直接填真实 ID）：

| 别名 | Groq | LLM7 | NVIDIA | Kilo |
|---|---|---|---|---|
| `gpt-oss-120b` | `openai/gpt-oss-120b` | `gpt-oss` | `openai/gpt-oss-120b` | `kilo-auto/free` |
| `gpt-oss-20b` | `openai/gpt-oss-20b` | `gpt-oss:20b` | `openai/gpt-oss-20b` | `kilo-auto/free` |
| `qwen` | `qwen/qwen3.8-27b` | `qwen3-235b` | `qwen/qwen3-235b-a22b` | `nemotron…:free` |
| `deepseek` | — | `deepseek-v4-pro` | `deepseek-ai/deepseek-v4.1-flash` | `kilo-auto/free` |

**AI Horde 特殊说明**：它的 OpenAI 代理有若干限制，网关已自动处理——`max_tokens` 不足 16 会被抬到 16（否则 422）、`stop` 强制转数组、不支持 tool calling 会直接丢弃相关字段、强制非流式。另外它靠志愿者算力排队，**单次可能几十秒到几分钟，质量因 worker 而异**，仅建议作最后兜底。

> Kilo 免费档只认带 `:free` 的 ID，其他会自动回退到 `kilo-auto/free`。

---

## 五、强制指定上游

```
POST /groq/v1/chat/completions      # 强制 Groq
POST /llm7/v1/chat/completions      # 强制 LLM7
POST /kilo/v1/chat/completions      # 强制 Kilo
POST /nvidia/v1/chat/completions    # 强制 NVIDIA
POST /pollinations/v1/chat/completions  # 强制 Pollinations
POST /aihorde/v1/chat/completions       # 强制 AI Horde
GET  /healthz                       # 连通性自检（无需认证）
```

响应头 `X-Upstream-Provider` 告诉你这条实际走了谁；降级过会带 `X-Fallback-Log`。

---

## 六、安全建议

| 项 | 做法 |
|---|---|
| 设 `ADMIN_PASSWORD` | 不设的话后台任何人可进 |
| 设 `ACCESS_KEY` | 不设的话接口任何人可调 |
| 只监听 127.0.0.1 | compose 里已这样配，别改成 `0.0.0.0` |
| 目录保护 | 宝塔站点 → 目录保护，加一层密码 |
| 不放行 3002 | 防火墙只开 80/443/SSH |

---

## 七、日常维护

```bash
cd /opt/ai-gateway
docker compose logs -f              # 看日志
docker compose restart              # 重启
docker compose pull && docker compose up -d   # 升级镜像
docker compose down                 # 停止
```

配置文件在 volume 里（`ai-gateway-data`），**重启和升级都不会丢**。

想备份配置：

```bash
docker run --rm -v ai-gateway-data:/d -v $PWD:/b alpine cp /d/config.json /b/config.json.bak
```

---

## 八、本地构建镜像

```bash
git clone https://github.com/suanx/ai-gateway-docker.git
cd ai-gateway-docker
docker build -t ai-gateway .
docker run -p 3002:3002 -e ADMIN_PASSWORD=x -e ACCESS_KEY=y ai-gateway
```

---

## 九、排错

| 现象 | 原因 | 解决 |
|---|---|---|
| `duplicate location "/"` | 反代目录有多个 .conf | `rm -f *.conf` 后重放一个 |
| 后台打不开 | Nginx 没重载 | `nginx -t && systemctl reload nginx` |
| 提示密码错误 | `ADMIN_PASSWORD` 改过 | 用新密码；或删 volume 重建 |
| `/healthz` 全红 | 上游 Key 无效或网络受限 | 检查 Key；换顺序 |
| 流式憋着不出 | Nginx 缓冲没关 | 确认 `proxy_buffering off` |
| 改了 Key 不生效 | 浏览器缓存 | 后台保存后点「重新检测」 |

MIT License
