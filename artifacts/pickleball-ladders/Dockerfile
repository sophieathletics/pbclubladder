FROM node:20-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Cache-bust: changing this value invalidates the git clone and every step
# after it, forcing a fresh clone and vite build on each deploy.
ARG CACHE_BUST=2026-04-21

# Clone the full monorepo so pnpm can resolve workspace packages from lib/
WORKDIR /monorepo
RUN echo "Cache bust: ${CACHE_BUST}" && \
    git clone --depth 1 --branch main https://github.com/sophieathletics/pbclubladder.git .

RUN pnpm install --no-frozen-lockfile

# PORT and BASE_PATH are inlined here only — not baked as ENV layers that
# would persist into the runtime stage and shadow Railway's injected PORT.
RUN echo "VITE_API_URL=https://workspaceapi-server-production-fd7e.up.railway.app" && \
    PORT=3000 BASE_PATH=/ NODE_ENV=production \
    VITE_API_URL=https://workspaceapi-server-production-fd7e.up.railway.app \
    pnpm --filter @workspace/pickleball-ladders build

# Runtime stage — serve reads PORT from the environment automatically
FROM node:20-slim
RUN npm install -g serve
WORKDIR /app
COPY --from=build /monorepo/artifacts/pickleball-ladders/dist/public /app

ENV NODE_ENV=production
CMD ["sh", "-c", "serve -s . -l $PORT"]
