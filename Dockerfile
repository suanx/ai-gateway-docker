# 多阶段构建：依赖装在 builder，运行时只带生产依赖
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
# 只装生产依赖，锁定版本保证可复现
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime
WORKDIR /app

# 非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nodejs -G nodejs

COPY --chown=nodejs:nodejs package.json ./
COPY --chown=nodejs:nodejs --from=build /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs lib/ ./lib/
COPY --chown=nodejs:nodejs views/ ./views/

# 数据目录（配置持久化）
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data
VOLUME ["/app/data"]

USER nodejs
ENV PORT=3002 \
    DATA_DIR=/app/data \
    NODE_ENV=production

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3002)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
