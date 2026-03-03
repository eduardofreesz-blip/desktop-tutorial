# Universal Recargas

Admin dashboard (Next.js 14 App Router) para vender códigos de recarga via WhatsApp.

## Requisitos

- Node.js 20
- Yarn
- PostgreSQL 16

## Rodar localmente

- `yarn dev`

Variáveis mínimas no `.env`:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL=http://localhost:3000`

Sincronizar schema (sem migrations neste repo):

- `npx prisma db push`

Seed (contas de teste / apps / planos):

- `npx tsx --require dotenv/config scripts/seed.ts`

## Deploy na VPS

Veja o guia completo em `DEPLOY_VPS.md`.
