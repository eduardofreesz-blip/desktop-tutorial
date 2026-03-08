#!/bin/bash
# Script de deploy - executa no servidor
set -e
cd "$(dirname "$0")/.."
echo ">>> git pull"
git pull origin main
echo ">>> yarn install"
yarn install --frozen-lockfile
echo ">>> yarn build"
yarn build
echo ">>> pm2 restart"
pm2 restart all
echo ">>> Deploy concluído!"
