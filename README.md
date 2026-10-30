# AI 网关 Docker 版

多上游 AI 网关（**Groq · LLM7 · Kilo · NVIDIA · Pollinations · AI Horde**），带 **Web 管理后台**，一条 `docker compose up -d` 部署到 VPS。

```
┌─────────────┐
│  客户端/工具  │  base_url = https://你的域名/v1
└──────┬──────┘
       ▼
┌─────────────┐    ┌──────────────────────────┐
│  Nginx HTTPS │───▶│  ai-gateway (Docker)     │
└─────────────┘    │  /admin  管理后台         │
                   │  /v1/*   OpenAI 兼容接口  │
                   └────┬─────┬─────┬─────┬────┘
                        ▼     ▼     ▼     ▼
          Groq  LLM7  Kilo  NVIDIA  Pollinations  AI Horde  ← 挂了自动降级
```

## 为什么用这个

| | 边缘函数版（groq-edgeone-proxy） | **本版（Docker）** |
|---|---|---|
| 运行位置 | Cloudflare / EdgeOne | **你自己的 VPS** |
| 请求时长限制 | 有（免费档 CPU 10ms/次） | **无** |
| 每日次数 | 10 万次硬顶 | **无限制** |
| 配置方式 | 环境变量 + 重新部署 | **Web 后台，改完立即生效** |
| 适合 | 翻译、短请求 | **编程工具、长对话、Agent** |

## 特性

- **Fastify + EJS 服务端渲染** —— 模板是真正的 `.ejs` 文件，页面显隐由服务端决定，不依赖客户端 JS
- **Web 后台** `/admin` —— 填 Key、看连通性、在线测试，不用碰命令行
- **配置持久化** —— 存 `/app/data/config.json`（挂载卷），重启升级都不丢
- **自动降级** —— 上游 4xx/5xx/网络错误自动切下一个，最多重试全部上游
- **请求体规范化** —— 自动适配各上游对 OpenAI 契约的偏离（如 AI Horde 的 `max_tokens`/`stop`/`tools` 约束）
- **模型名翻译** —— 填 `gpt-oss-120b`，自动按上游转成各自 ID
- **SSE 流式透传** —— 逐字输出，不被缓冲
- **安全加固** —— 非 root 运行、`cap_drop: ALL`、日志轮转

## 一分钟部署

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

然后打开 `http://服务器IP:3002/admin` 配置 Key。

📖 **完整宝塔面板部署教程见 [`deploy/README.md`](deploy/README.md)**（含 Nginx 配置、反代避坑、SSL、安全加固）

## 端点

| 路径 | 说明 |
|---|---|
| `/admin` | **Web 管理后台** |
| `/healthz` | 连通性自检（JSON，无需认证） |
| `/v1/*` | 自动选上游，失败降级 |
| `/groq/v1/*` `/llm7/v1/*` `/kilo/v1/*` `/nvidia/v1/*` `/pollinations/v1/*` `/aihorde/v1/*` | 强制指定上游 |

## 管理后台能做啥

| 功能 | 说明 |
|---|---|
| 上游状态 | 四家是否配置、能否连通，实时显示 |
| 密钥配置 | 填各家 Key，保存立即生效（不用重启） |
| 在线测试 | 选端点 + 模型发请求，看流式输出和命中的上游 |
| 优先级 | 调 `provider_order`，逗号分隔 |

## 客户端接入

```
Base URL: https://你的域名/v1
API  Key: 你的 ACCESS_KEY
模型:     gpt-oss-120b
```

## 上游额度参考

| 上游 | 是否需要 Key | 额度 |
|---|---|---|
| Groq | 需要 | 30 次/分 |
| LLM7 | **匿名可用** | 匿名 10 次/分，配 Key 60 次/分 |
| Kilo | **匿名可用** | 200 次/小时 |
| NVIDIA | 需要 | 约 40 RPM |
| Pollinations | **匿名可用** | 共享容量，未公布 |
| AI Horde | **匿名可用** | Kudos 队列，无 Token 上限（但极慢） |

未配 Key 的上游会自动跳过，不参与降级。

## 本地开发/构建

```bash
docker build -t ai-gateway .
docker run -p 3002:3002 -e ADMIN_PASSWORD=x -e ACCESS_KEY=y ai-gateway

# 或直接跑
DATA_DIR=/tmp/gw PORT=3002 node server.js
```

## 文件结构

```
server.js              主服务（路由 + 鉴权）
lib/providers.js       上游注册表（新增上游改这里）
lib/proxy.js           转发 + 降级 + 模型翻译
lib/store.js           配置持久化 + 会话
lib/admin.js           管理后台页面（单文件）
Dockerfile             多阶段构建，非 root
docker-compose.yml     编排（含安全加固）
deploy/
  README.md            宝塔部署完整教程
  nginx-proxy.conf     Nginx 反代配置（含 SSE 必需指令）
```

## 相关项目

- [`suanx/groq-edgeone-proxy`](https://github.com/suanx/groq-edgeone-proxy) —— 同款网关的**边缘函数版**，跑在 Cloudflare/EdgeOne，适合翻译等短请求
- [`suanx/freellmapi`](https://github.com/suanx/freellmapi) —— FreeLLMAPI 精简版，34 家上游聚合（另一套方案）

---

MIT License
