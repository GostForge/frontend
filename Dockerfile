FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app
RUN npm install -g --no-audit --no-fund serve@14.2.4

COPY --from=build /app/dist ./dist

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["serve", "-s", "dist", "-l", "3001"]
