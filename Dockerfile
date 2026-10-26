FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY infra/package.json ./infra/package.json
RUN corepack enable && pnpm install --frozen-lockfile
COPY tsconfig.json build.mjs ./
COPY src ./src
COPY apps/web ./apps/web
COPY apps/mobile ./apps/mobile
RUN pnpm run build && pnpm run build:mobile

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV NODE_EXTRA_CA_CERTS=/app/certs/rds-global-bundle.pem
RUN mkdir -p /app/certs && node -e "const fs=require('node:fs'); fetch('https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem').then(async r=>{if(!r.ok)throw new Error('RDS CA download failed');const pem=await r.text();if(!pem.includes('BEGIN CERTIFICATE'))throw new Error('Invalid RDS CA bundle');fs.writeFileSync('/app/certs/rds-global-bundle.pem',pem)}).catch(e=>{console.error(e.message);process.exit(1)})"
RUN groupadd --system magnet && useradd --system --gid magnet --home-dir /app --shell /usr/sbin/nologin magnet
# esbuild bundles runtime dependencies; the release test runs without node_modules.
COPY --from=build --chown=magnet:magnet /app/dist ./dist
COPY scripts/container-entrypoint.sh /usr/local/bin/magnet-entrypoint
RUN chmod 755 /usr/local/bin/magnet-entrypoint
RUN mkdir -p /app/.data && chown magnet:magnet /app/.data
ENTRYPOINT ["/usr/local/bin/magnet-entrypoint"]
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
