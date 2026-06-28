# ============================================================================
# EncuentroVE — imagen combinada (api-server Express + frontend Vite/nginx)
# para despliegue en EasyPanel. Build context = raiz del repo (monorepo pnpm).
# ============================================================================

FROM node:20-alpine AS builder
WORKDIR /app
# Pinned to pnpm 10.x: pnpm@latest (11.x) requires Node >=22.13 (uses the
# node:sqlite built-in, absent on Node 20) and breaks this build.
RUN corepack enable && corepack prepare pnpm@10 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY scripts/ ./scripts/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/encuentrove-web/ ./artifacts/encuentrove-web/

RUN pnpm install --frozen-lockfile

# 1) Build del api-server (Express -> bundle esbuild autocontenido en dist/*.mjs)
RUN pnpm --filter @workspace/api-server run build

# 2) Build del frontend (Vite -> estatico en dist/public)
#    BASE_PATH=/ porque se sirve en la raiz del dominio.
#    PORT solo es requerido en build time por vite.config.ts (no se usa en
#    runtime, nginx sirve los estaticos directamente).
RUN cd artifacts/encuentrove-web && BASE_PATH=/ PORT=3000 pnpm run build

# ============================================================================
FROM node:20-alpine
RUN apk add --no-cache nginx

WORKDIR /app

# api-server: el bundle de esbuild es autocontenido (sin node_modules en runtime).
COPY --from=builder /app/artifacts/api-server/dist ./api-server/dist

# frontend estatico
COPY --from=builder /app/artifacts/encuentrove-web/dist/public /usr/share/nginx/html

COPY deploy/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/nginx-maps.conf /etc/nginx/http.d/nginx-maps.conf
COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# El APK de Android ya no se sirve desde este contenedor — el boton de
# descarga del Home apunta directo a una URL de S3 (ver APK_URL en
# artifacts/encuentrove-web/src/components/DescargaApp.tsx).

ENV NODE_ENV=production

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/api/healthz || exit 1

CMD ["/docker-entrypoint.sh"]
