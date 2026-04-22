FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy everything — pnpm install must run from the monorepo root
COPY . .

RUN pnpm install --no-frozen-lockfile

# PORT and BASE_PATH are needed at build time for vite.config.ts
ENV PORT=3000
ENV BASE_PATH=/
ENV NODE_ENV=production

RUN pnpm --filter @workspace/pickleball-ladders build

# PORT is overridden at runtime by Railway
EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @workspace/pickleball-ladders serve"]
