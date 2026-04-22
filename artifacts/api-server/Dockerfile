FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy everything — pnpm install must run from the monorepo root
COPY . .

RUN pnpm install --no-frozen-lockfile

RUN pnpm --filter @workspace/api-server build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
