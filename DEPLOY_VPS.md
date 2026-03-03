# Deploy na VPS (Ubuntu/Debian)

Este projeto é um **Next.js 14 (App Router)** com **PostgreSQL + Prisma** e **NextAuth (credentials)**.

## Pré‑requisitos

- VPS Linux (Ubuntu/Debian recomendado)
- Domínio apontado para a VPS (opcional, mas recomendado para HTTPS)
- Portas liberadas:
  - 80/443 (Nginx/HTTPS)
  - 3005 (opcional, só se você expor direto sem Nginx)

## Opção A (recomendada): Docker Compose

### 1) Instalar Docker

No Ubuntu, instale Docker + plugin do Compose conforme a documentação oficial (Docker Engine). Depois confirme:

- `docker --version`
- `docker compose version`

### 2) Clonar o projeto na VPS

Exemplo:

- `sudo mkdir -p /var/www/universal_recargas`
- `sudo chown -R $USER:$USER /var/www/universal_recargas`
- `cd /var/www/universal_recargas`
- `git clone <SEU_REPO_AQUI> .`

### 3) Criar o `.env`

Copie o arquivo de exemplo e edite:

- `cp .env.example .env`

Edite os principais:

- `NEXTAUTH_URL`: sua URL pública (ex.: `https://painel.seudominio.com`)
- `NEXTAUTH_SECRET`: um segredo longo e aleatório
- `DATABASE_URL`: para o Docker Compose, use o host `db`:
  - `postgresql://universal_user:SENHA@db:5432/universal_recargas`
- `POSTGRES_PASSWORD`: defina a senha do Postgres (e use a mesma na `DATABASE_URL`)
- Integrações (Getnet/PagSeguro/WhatsApp etc.) se você for usar

### 4) Subir os containers

- `docker compose up -d --build`

### 5) Criar/atualizar o schema no banco (Prisma)

Este repo não contém `prisma/migrations`, então o caminho padrão é **db push**:

- `docker compose exec app npx prisma db push`

Opcional (seed de contas/apps/códigos):

- `docker compose exec app npx tsx --require dotenv/config scripts/seed.ts`

### 6) (Opcional) Nginx como reverse proxy + HTTPS

Instale:

- `sudo apt-get update`
- `sudo apt-get install -y nginx`

Crie um server block (exemplo) em `/etc/nginx/sites-available/universal-recargas` apontando para o Next em `127.0.0.1:3005`:

- `sudo nano /etc/nginx/sites-available/universal-recargas`

Config sugerida:

- `server {`
- `  listen 80;`
- `  server_name SEU_DOMINIO.com;`
- `  client_max_body_size 25m;`
- `  location / {`
- `    proxy_pass http://127.0.0.1:3005;`
- `    proxy_http_version 1.1;`
- `    proxy_set_header Host $host;`
- `    proxy_set_header X-Real-IP $remote_addr;`
- `    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
- `    proxy_set_header X-Forwarded-Proto $scheme;`
- `    proxy_set_header Upgrade $http_upgrade;`
- `    proxy_set_header Connection "upgrade";`
- `  }`
- `}`

Ative o site:

- `sudo ln -s /etc/nginx/sites-available/universal-recargas /etc/nginx/sites-enabled/universal-recargas`
- `sudo nginx -t`
- `sudo systemctl reload nginx`

HTTPS com Certbot:

- `sudo apt-get install -y certbot python3-certbot-nginx`
- `sudo certbot --nginx -d SEU_DOMINIO.com`

### Persistência da sessão do WhatsApp

O Baileys salva credenciais no diretório `WA_AUTH_DIR` (por padrão, o Compose monta em `/data/wa_auth` via volume `wa_auth`). Isso mantém a sessão após restart/deploy.

## Opção B: sem Docker (Node + PM2)

Esta opção reaproveita o `ecosystem.config.js` (PM2) que já existe no repo.

### 1) Instalar Node 20 + Yarn

Instale Node.js 20 e habilite `corepack`:

- `node -v`
- `corepack enable`
- `yarn -v`

### 2) Postgres 16

Instale e crie o banco/usuário (exemplo):

- `sudo apt-get install -y postgresql-16`
- `sudo systemctl enable --now postgresql`
- `sudo -u postgres psql`

No `psql`:

- `CREATE USER universal_user WITH PASSWORD 'SENHA_FORTE_AQUI';`
- `CREATE DATABASE universal_recargas OWNER universal_user;`

Depois ajuste no `.env` (no servidor):

- `DATABASE_URL=postgresql://universal_user:SENHA_FORTE_AQUI@localhost:5432/universal_recargas`

### 3) Instalar dependências e build

No diretório do projeto:

- `yarn install --frozen-lockfile`
- `npx prisma db push`
- `npx tsx --require dotenv/config scripts/seed.ts` (opcional)
- `yarn build`

### 4) Rodar com PM2

Instale PM2:

- `sudo npm i -g pm2`

O arquivo `ecosystem.config.js` assume `cwd: /var/www/universal_recargas` e porta `3005`.
Garanta que o projeto está nesse caminho, ou ajuste o `cwd`/porta.

Iniciar:

- `pm2 start ecosystem.config.js`
- `pm2 save`
- `pm2 startup` (siga as instruções que o comando imprimir)

### 5) Nginx + HTTPS

Mesma configuração do Nginx descrita na opção Docker (proxy para `127.0.0.1:3005`).

## Checklist rápido (produção)

- `NEXTAUTH_URL` aponta para o domínio público correto (HTTPS)
- `NEXTAUTH_SECRET` definido e estável (não troque depois do app em produção)
- `DATABASE_URL` aponta para o Postgres correto
- `WA_AUTH_DIR` persistente (pra não perder sessão do WhatsApp)
- Nginx com headers `X-Forwarded-*` (evita problemas de callback/URL no NextAuth)
