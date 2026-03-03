FROM node:20-bookworm-slim AS base
WORKDIR /app

# Dependências nativas mínimas (OpenSSL/CA) usadas por Prisma/HTTPS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
ENV NODE_ENV=development

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

# Prisma generate precisa do schema presente no install/build
COPY prisma ./prisma
RUN npx prisma generate

FROM base AS builder
ENV NODE_ENV=production

# Habilita modo standalone se você quiser (opcional); não quebra se ignorado.
ENV NEXT_OUTPUT_MODE=standalone

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN yarn build

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3005

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next

EXPOSE 3005

CMD ["sh", "-c", "node_modules/.bin/next start -p ${PORT:-3005} -H 0.0.0.0"]
