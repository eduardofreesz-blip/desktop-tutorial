#!/bin/bash
# Script de deploy - execute no servidor: ./scripts/deploy.sh
# Ou: cd /var/www/universal_recargas && bash scripts/deploy.sh
set -e
cd "$(dirname "$0")/.."
echo ">>> Diretório: $(pwd)"
echo ">>> git pull"
git pull origin main
COMMIT=$(git rev-parse --short HEAD)
echo ">>> Commit: $COMMIT"
echo ">>> yarn install"
yarn install --frozen-lockfile
echo ">>> yarn build"
yarn build
# Atualizar .env com marker para verificar deploy
if [ -f .env ]; then
  grep -q "BOT_BUILD_MARKER" .env && sed -i "s/BOT_BUILD_MARKER=.*/BOT_BUILD_MARKER=build-$COMMIT/" .env || echo "BOT_BUILD_MARKER=build-$COMMIT" >> .env
fi
echo ">>> pm2 restart"
pm2 restart all
echo ""
echo ">>> Deploy concluído! Commit: $COMMIT"
echo ">>> Verifique: curl https://SEU_DOMINIO/api/deploy-info"
echo ">>> O menu do bot deve mostrar '_build-$COMMIT_' ou '_v2_' no final"
