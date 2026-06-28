FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/encuentrove-web/ ./artifacts/encuentrove-web/
RUN pnpm install --frozen-lockfile
RUN cd artifacts/encuentrove-web && BASE_PATH=/ PORT=3000 pnpm run build

FROM nginx:alpine
COPY --from=builder /app/artifacts/encuentrove-web/dist/public /usr/share/nginx/html
COPY artifacts/encuentrove-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY artifacts/encuentrove-web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
CMD ["/docker-entrypoint.sh"]
