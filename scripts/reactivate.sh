#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "[reactivate] .env não encontrado. Copiando de .env.example..."
  cp .env.example .env
  echo "[reactivate] Arquivo .env criado. Revise DATABASE_URL e NEXTAUTH_SECRET antes de produção."
fi

echo "[reactivate] Gerando cliente Prisma..."
npx prisma generate

echo "[reactivate] Sincronizando schema no banco..."
npx prisma db push

if [ "${SEED:-0}" = "1" ]; then
  echo "[reactivate] Executando seed..."
  npx tsx --require dotenv/config scripts/seed.ts
fi

echo "[reactivate] Iniciando aplicação em modo desenvolvimento..."
yarn dev
