#!/usr/bin/env bash
# ============================================================
# update.sh — Atualizar Universal Recargas na VPS
# Execute: sudo bash /var/www/universal_recargas/update.sh
#
# O que este script faz:
#   1. Faz git pull da branch configurada
#   2. Instala novas dependências (se houver)
#   3. Regera o Prisma Client
#   4. Aplica novas migrations ao banco
#   5. Faz o build de produção
#   6. Reinicia a aplicação com PM2 (zero-downtime)
# ============================================================
set -euo pipefail

APP_DIR="/var/www/universal_recargas"
BRANCH="cursor/aplica-o-na-vps-76cb"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERRO]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "Execute como root: sudo bash update.sh"
[[ ! -d "${APP_DIR}/.git" ]] && error "Diretório ${APP_DIR} não encontrado. Rode deploy.sh primeiro."

cd "${APP_DIR}"

info "=============================================="
info "  Universal Recargas — Atualização"
info "=============================================="

# ── 1. Atualizar código ────────────────────────────────────
info "Baixando atualizações do repositório..."
git fetch origin
git reset --hard "origin/${BRANCH}"
success "Código atualizado para o commit: $(git rev-parse --short HEAD)"

# ── 2. Dependências ───────────────────────────────────────
info "Verificando dependências..."
yarn install --frozen-lockfile 2>&1 | tail -3
success "Dependências ok."

# ── 3. Prisma ─────────────────────────────────────────────
info "Gerando Prisma Client..."
npx prisma generate

info "Aplicando alterações no banco de dados..."
npx prisma db push --skip-generate
success "Banco de dados atualizado."

# ── 4. Build ──────────────────────────────────────────────
info "Fazendo build de produção..."
yarn build
success "Build concluído."

# ── 5. Reiniciar PM2 ──────────────────────────────────────
info "Reiniciando aplicação..."
if pm2 show universal-recargas &>/dev/null; then
    pm2 reload universal-recargas --update-env
else
    pm2 start "${APP_DIR}/ecosystem.config.js"
fi
pm2 save
success "Aplicação reiniciada."

# ── Resumo ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}✓ Atualização concluída! Commit: $(git rev-parse --short HEAD)${NC}"
echo ""
echo -e " ${YELLOW}pm2 logs universal-recargas${NC}  — verificar logs"
echo -e " ${YELLOW}pm2 status${NC}                   — ver status"
