#!/bin/bash
set -e

# ============================================
# Universal Recargas - Script de Deploy
# ============================================
# Uso: bash deploy.sh
# Execute na VPS dentro do diretório do projeto

APP_DIR="/var/www/universal_recargas"
APP_NAME="universal-recargas"
BRANCH="main"

echo "=========================================="
echo "  Deploy - Universal Recargas"
echo "=========================================="

cd "$APP_DIR"

echo ""
echo "[1/7] Baixando atualizações do Git..."
git fetch origin
git reset --hard "origin/$BRANCH"

echo ""
echo "[2/7] Instalando dependências..."
yarn install --frozen-lockfile || yarn install

echo ""
echo "[3/7] Gerando Prisma Client..."
npx prisma generate

echo ""
echo "[4/7] Aplicando migrações do banco de dados..."
npx prisma db push --accept-data-loss

echo ""
echo "[5/7] Fazendo build da aplicação..."
yarn build

echo ""
echo "[6/7] Criando diretórios necessários..."
mkdir -p logs
mkdir -p storage/wa-session

echo ""
echo "[7/7] Reiniciando aplicação com PM2..."
pm2 startOrRestart ecosystem.config.js --update-env
pm2 save

echo ""
echo "=========================================="
echo "  Deploy concluído com sucesso!"
echo "=========================================="
echo ""
echo "Comandos úteis:"
echo "  pm2 status              - Ver status da aplicação"
echo "  pm2 logs $APP_NAME      - Ver logs em tempo real"
echo "  pm2 restart $APP_NAME   - Reiniciar aplicação"
echo "  pm2 monit               - Monitor de performance"
