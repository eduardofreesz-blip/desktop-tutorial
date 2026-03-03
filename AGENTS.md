# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

**Universal Recargas** is a Next.js 14 (App Router) admin dashboard for selling recharge codes via WhatsApp. Tech stack: PostgreSQL + Prisma, NextAuth (credentials), Tailwind CSS + shadcn/ui, Recharts. Integrates with WhatsApp (Baileys), Telegram, payment gateways (Getnet, PagSeguro, FitBank, Itaú, Sicoob), and AWS S3.

### Project structure

- `app/(admin)/` — Admin route group (dashboard, orders, codes, apps, settings, etc.)
- `app/api/` — 76 API route files (CRUD for all entities, webhooks, payments, WhatsApp, Telegram)
- `app/page.tsx` — Login page
- `app/register/` — Registration page
- `components/ui/` — shadcn/ui components
- `components/theme-provider.tsx` — Theme provider
- `lib/` — Utilities (db, auth, WhatsApp, S3, AI agent, bot logic)
- `prisma/schema.prisma` — Database schema (14 models)
- `scripts/seed.ts` — Seed script for sample data
- `hooks/` — React hooks (use-toast)

### Running locally

- **Dev server**: `yarn dev` (port 3000)
- **Lint**: `yarn lint`
- **Build**: `yarn build`
- **Seed**: `npx tsx --require dotenv/config scripts/seed.ts`
- **Prisma**: `npx prisma db push` to sync schema, `npx prisma generate` for client

### Database

PostgreSQL 16 must be running. Start with `sudo pg_ctlcluster 16 main start`. User `universal_user`, database `universal_recargas`. The `pg_hba.conf` has `md5` auth for this user (not peer).

### Test accounts

- `admin@universalrecargas.com` / `admin123` (from seed)
- `john@doe.com` / `johndoe123` (from seed)

### Important caveats

- `lib/db.ts` was recreated as a standard Prisma singleton (not in original VPS upload).
- `.yarnrc.yml` was simplified from VPS (removed Hostinger-specific paths). Uses `nodeLinker: node-modules`.
- The `(admin)` route group may need a layout.tsx with sidebar — check VPS if pages lack navigation.
- `.env` must have `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3000`.
