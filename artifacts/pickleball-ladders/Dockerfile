FROM node:22-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Auto cache-bust: ADD fetches this URL at build time. The GitHub API returns
# the latest commit SHA for main, so every push automatically invalidates this
# layer and all layers after it — no manual bumping needed.
WORKDIR /monorepo
ADD https://api.github.com/repos/sophieathletics/pbclubladder/git/refs/heads/main /tmp/latest-commit
RUN git clone --depth 1 --branch main https://github.com/sophieathletics/pbclubladder.git .

RUN pnpm install --no-frozen-lockfile

# PORT and BASE_PATH are inlined here only — not baked as ENV layers that
# would persist into the runtime stage and shadow Railway's injected PORT.
RUN echo "VITE_API_URL=https://api.pbclubladder.com" && \
    PORT=3000 BASE_PATH=/ NODE_ENV=production \
    VITE_API_URL=https://api.pbclubladder.com \
    VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51TNGdk2MA2q6YDRjXphofUqfaHh84Vo7JodtiIydT5g4kmLDON056sOzeESBDx4FqRg3PLRDiE6BWj6lMDD2xFW4007AQE2B9U \
    pnpm --filter @workspace/pickleball-ladders build

# Runtime stage — serve reads PORT from the environment automatically
FROM node:22-slim
RUN npm install -g serve
WORKDIR /app
COPY --from=build /monorepo/artifacts/pickleball-ladders/dist/public /app

ENV NODE_ENV=production
CMD ["sh", "-c", "serve -s . -l $PORT"]
