#!/usr/bin/env bash
# ============================================================
# deploy.sh — Instalação inicial da Universal Recargas na VPS
# Execute como root ou com sudo:  sudo bash deploy.sh
#
# O que este script faz:
#   1. Instala Node.js 20 LTS, Yarn, PM2
#   2. Instala e configura PostgreSQL 16
#   3. Cria o banco de dados e usuário
#   4. Clona o repositório (ou usa o diretório atual)
#   5. Configura o .env de produção
#   6. Instala dependências e faz o build
#   7. Roda as migrations do Prisma
#   8. Inicia a aplicação com PM2
#   9. Instala e configura o Nginx
#  10. Configura SSL com Certbot (opcional)
# ============================================================
set -euo pipefail

# ── Configurações — EDITE AQUI ─────────────────────────────
APP_DIR="/var/www/universal_recargas"
REPO_URL="https://github.com/eduardofreesz-blip/desktop-tutorial.git"
BRANCH="cursor/aplica-o-na-vps-76cb"
DB_NAME="universal_recargas"
DB_USER="universal_user"
# Senha do banco — altere para uma senha forte antes de executar!
DB_PASS="UnivRecargas2026!"
DOMAIN=""          # Ex: meusite.com.br  — deixe vazio para pular SSL
APP_PORT="3005"
# ───────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERRO]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "Execute como root: sudo bash deploy.sh"

info "=============================================="
info "  Universal Recargas — Deploy Inicial VPS"
info "=============================================="

# ── 1. Atualizar sistema ───────────────────────────────────
info "Atualizando pacotes do sistema..."
apt-get update -qq
apt-get install -y -qq curl git wget unzip gnupg2 ca-certificates lsb-release software-properties-common

# ── 2. Node.js 20 LTS ─────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -e 'process.exit(parseInt(process.version.slice(1)) < 20 ? 1 : 0)' ; echo $?)" == "1" ]]; then
    info "Instalando Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    info "Node.js $(node -v) já instalado."
fi
success "Node.js $(node -v) / npm $(npm -v)"

# ── 3. Yarn ───────────────────────────────────────────────
if ! command -v yarn &>/dev/null; then
    info "Instalando Yarn..."
    npm install -g yarn --quiet
fi
success "Yarn $(yarn -v)"

# ── 4. PM2 ────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
    info "Instalando PM2..."
    npm install -g pm2 --quiet
fi
success "PM2 $(pm2 -v)"

# ── 5. PostgreSQL 16 ──────────────────────────────────────
if ! command -v psql &>/dev/null; then
    info "Instalando PostgreSQL 16..."
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    apt-get update -qq
    apt-get install -y postgresql-16
else
    info "PostgreSQL $(psql --version | awk '{print $3}') já instalado."
fi

info "Iniciando PostgreSQL..."
pg_ctlcluster 16 main start 2>/dev/null || true
systemctl enable postgresql 2>/dev/null || true
success "PostgreSQL rodando."

# ── 6. Banco de dados ─────────────────────────────────────
info "Configurando banco de dados..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>/dev/null || true

# Garantir autenticação md5 no pg_hba.conf
PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
if ! grep -q "^host.*${DB_NAME}.*${DB_USER}.*md5" "${PG_HBA}" 2>/dev/null; then
    echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    md5" >> "${PG_HBA}"
    pg_ctlcluster 16 main reload
fi
success "Banco '${DB_NAME}' e usuário '${DB_USER}' configurados."

# ── 7. Diretório da aplicação ──────────────────────────────
info "Preparando diretório ${APP_DIR}..."
mkdir -p "${APP_DIR}"

if [[ -d "${APP_DIR}/.git" ]]; then
    info "Repositório já existe — atualizando..."
    git -C "${APP_DIR}" fetch origin
    git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
    git -C "${APP_DIR}" checkout "${BRANCH}"
    git -C "${APP_DIR}" pull origin "${BRANCH}"
else
    info "Clonando repositório..."
    git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi
success "Código em ${APP_DIR}"

# ── 8. Arquivo .env ───────────────────────────────────────
ENV_FILE="${APP_DIR}/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
    info "Criando .env de produção..."
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    DOMAIN_URL="${DOMAIN:-http://localhost:${APP_PORT}}"
    [[ -n "${DOMAIN}" ]] && DOMAIN_URL="https://${DOMAIN}"

    cat > "${ENV_FILE}" <<EOF
DATABASE_URL='postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}'
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=${DOMAIN_URL}

NODE_ENV=production
PORT=${APP_PORT}

# Preencha as credenciais dos gateways de pagamento:
GETNET_ENVIRONMENT=production
GETNET_CLIENT_ID=
GETNET_CLIENT_SECRET=
GETNET_SELLER_ID=

PAGSEGURO_TOKEN=
PAGSEGURO_EMAIL=
PAGSEGURO_ENVIRONMENT=production

WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=universal_recargas_webhook_token

WA_PROXY_URL=
WA_SESSION_DIR=./storage/wa-session
WA_AUTH_DIR=./wa_auth
WA_LOG_LEVEL=warn

WS_NO_BUFFER_UTIL=1
EOF
    success ".env criado em ${ENV_FILE}"
    warn "IMPORTANTE: edite ${ENV_FILE} com suas credenciais reais antes de continuar!"
    warn "Pressione ENTER para continuar ou CTRL+C para editar primeiro..."
    read -r
else
    success ".env já existe — mantendo configuração atual."
fi

# ── 9. Diretórios de sessão WhatsApp ──────────────────────
mkdir -p "${APP_DIR}/storage/wa-session"
mkdir -p "${APP_DIR}/wa_auth"
success "Diretórios de sessão WhatsApp criados."

# ── 10. Instalar dependências ──────────────────────────────
info "Instalando dependências (pode demorar alguns minutos)..."
cd "${APP_DIR}"
yarn install --frozen-lockfile 2>&1 | tail -5
success "Dependências instaladas."

# ── 11. Prisma — gerar client e aplicar schema ────────────
info "Gerando Prisma Client..."
npx prisma generate

info "Aplicando schema ao banco de dados..."
npx prisma db push --skip-generate

success "Schema do banco sincronizado."

# ── 12. Build da aplicação ────────────────────────────────
info "Fazendo build de produção (pode demorar)..."
yarn build
success "Build concluído."

# ── 13. PM2 ───────────────────────────────────────────────
info "Iniciando aplicação com PM2..."
pm2 stop universal-recargas 2>/dev/null || true
pm2 delete universal-recargas 2>/dev/null || true
pm2 start "${APP_DIR}/ecosystem.config.js"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
success "Aplicação rodando na porta ${APP_PORT}"

# ── 14. Nginx ─────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
    info "Instalando Nginx..."
    apt-get install -y nginx
fi

NGINX_CONF="/etc/nginx/sites-available/universal-recargas"
NGINX_ENABLED="/etc/nginx/sites-enabled/universal-recargas"

# Copiar config do nginx do projeto
cp "${APP_DIR}/nginx/universal-recargas.conf" "${NGINX_CONF}"

# Substituir o placeholder do domínio se fornecido
if [[ -n "${DOMAIN}" ]]; then
    sed -i "s/seudominio\.com\.br/${DOMAIN}/g" "${NGINX_CONF}"
else
    # Sem domínio: criar config HTTP simples
    cat > "${NGINX_CONF}" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        add_header Cache-Control "public, immutable, max-age=31536000";
        access_log off;
    }
}
EOF
fi

# Ativar site
[[ -L "${NGINX_ENABLED}" ]] && rm "${NGINX_ENABLED}"
ln -sf "${NGINX_CONF}" "${NGINX_ENABLED}"

# Remover default se existir
[[ -L "/etc/nginx/sites-enabled/default" ]] && rm "/etc/nginx/sites-enabled/default"

nginx -t && systemctl reload nginx && systemctl enable nginx
success "Nginx configurado e rodando."

# ── 15. SSL com Certbot (opcional) ────────────────────────
if [[ -n "${DOMAIN}" ]]; then
    if ! command -v certbot &>/dev/null; then
        info "Instalando Certbot..."
        apt-get install -y certbot python3-certbot-nginx
    fi
    info "Obtendo certificado SSL para ${DOMAIN}..."
    certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos \
        --email "admin@${DOMAIN}" --redirect 2>/dev/null || \
        warn "Certbot falhou — configure SSL manualmente depois."
    success "SSL configurado para ${DOMAIN}"
fi

# ── Resumo final ──────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Deploy concluído com sucesso!              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
[[ -z "${DOMAIN}" ]] && \
    echo -e " Acesse: ${CYAN}http://$(curl -s ifconfig.me 2>/dev/null || echo 'IP_DA_VPS')${NC}" || \
    echo -e " Acesse: ${CYAN}https://${DOMAIN}${NC}"
echo ""
echo -e " Comandos úteis:"
echo -e "   ${YELLOW}pm2 status${NC}                — ver status da app"
echo -e "   ${YELLOW}pm2 logs universal-recargas${NC} — ver logs em tempo real"
echo -e "   ${YELLOW}pm2 restart universal-recargas${NC} — reiniciar app"
echo -e "   ${YELLOW}bash ${APP_DIR}/update.sh${NC}  — atualizar para nova versão"
echo ""
echo -e " Login padrão (após seed):"
echo -e "   Email: ${YELLOW}admin@universalrecargas.com${NC}"
echo -e "   Senha: ${YELLOW}admin123${NC}  ← altere imediatamente!"
echo ""
warn "Se ainda não rodou o seed: cd ${APP_DIR} && npx tsx --require dotenv/config scripts/seed.ts"
