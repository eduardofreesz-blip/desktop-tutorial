# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

**Universal Recargas** is a Next.js 14 (App Router) admin dashboard for selling recharge codes via WhatsApp. It uses PostgreSQL + Prisma, NextAuth (credentials), Tailwind CSS + shadcn/ui, and integrates with WhatsApp (Baileys), Telegram, payment gateways (Getnet, PagSeguro), and AWS S3.

### Important caveats

- **Incomplete upload**: The original code was partially uploaded from a Hostinger VPS. The `app/api/` directory is mostly missing (only `auth/[...nextauth]` and `dashboard` routes exist locally). The `components/`, `scripts/`, and `public/` root-level directories from the VPS were not uploaded. Some pages may 404 due to missing API routes.
- **`lib/db.ts`** was recreated as a standard Prisma singleton — it was not in the original upload but is imported across many files.
- **`.yarnrc.yml`** was simplified from the VPS version (removed Hostinger-specific `globalFolder` path). Uses `nodeLinker: node-modules`.

### Running locally

- **Dev server**: `yarn dev` (runs on port 3000)
- **Lint**: `yarn lint`
- **Build**: `yarn build`
- **Database**: PostgreSQL 16 must be running. User `universal_user` with database `universal_recargas`. Run `npx prisma db push` to sync schema.
- **Test user**: `admin@universal.com` / `admin123` (created manually via SQL insert, password is bcrypt-hashed)

### Database setup (one-time)

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER universal_user WITH PASSWORD 'UnivRecargas2026!' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE universal_recargas OWNER universal_user;"
npx prisma db push
```

PostgreSQL `pg_hba.conf` needs `md5` auth for `universal_user` (not peer). This was configured during initial setup.

### Environment variables

Copy from `.env.example` or create `.env` with at minimum: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3000`.
