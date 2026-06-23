FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-slim

RUN groupadd -r cyberguard && useradd -r -g cyberguard -m appuser

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN mkdir -p logs uploads && chown -R appuser:cyberguard logs uploads

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
