FROM node:22-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Clone the full monorepo so pnpm can resolve workspace packages from lib/
WORKDIR /monorepo
ADD https://api.github.com/repos/sophieathletics/pbclubladder/git/refs/heads/main /tmp/latest-commit
RUN git clone --depth 1 --branch main https://github.com/sophieathletics/pbclubladder.git .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @workspace/api-server build

# Runtime stage — esbuild bundles everything, so only the dist dir is needed
FROM node:22-slim
WORKDIR /app
COPY --from=build /monorepo/artifacts/api-server/dist ./dist

ENV NODE_ENV=production
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
