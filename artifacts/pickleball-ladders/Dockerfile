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

# PORT and BASE_PATH are inlined here only — not baked as ENV layers that
# would persist into the runtime stage and shadow Railway's injected PORT.
RUN PORT=3000 BASE_PATH=/ NODE_ENV=production \
    pnpm --filter @workspace/pickleball-ladders build

# Runtime stage — serve reads PORT from the environment automatically
FROM node:20-slim
RUN npm install -g serve
WORKDIR /app
COPY --from=build /monorepo/artifacts/pickleball-ladders/dist/public ./public

ENV NODE_ENV=production
CMD ["serve", "-s", "public"]
