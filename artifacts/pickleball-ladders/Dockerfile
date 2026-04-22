FROM node:20-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Clone the full monorepo so pnpm can resolve workspace packages from lib/
WORKDIR /monorepo
RUN git clone --depth 1 --branch main https://github.com/sophieathletics/pbclubladder.git .

RUN pnpm install --no-frozen-lockfile

# PORT and BASE_PATH must be set at vite build time (vite.config.ts reads them)
ENV PORT=3000
ENV BASE_PATH=/
ENV NODE_ENV=production
RUN pnpm --filter @workspace/pickleball-ladders build

# Runtime stage — serve the static output with a lightweight static server
FROM node:20-slim
RUN npm install -g serve
WORKDIR /app
COPY --from=build /monorepo/artifacts/pickleball-ladders/dist/public ./public

ENV NODE_ENV=production
EXPOSE 3000
# serve reads PORT from the environment automatically; falls back to 3000
CMD ["sh", "-c", "serve -s public -l ${PORT:-3000}"]
