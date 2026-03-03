# Guia de Deploy na VPS - Universal Recargas

Guia completo para colocar a aplicação rodando em uma VPS com Ubuntu/Debian.

---

## Requisitos da VPS

| Item | Mínimo recomendado |
|------|--------------------|
| OS | Ubuntu 22.04+ ou Debian 12+ |
| RAM | 1 GB (2 GB recomendado) |
| CPU | 1 vCPU |
| Disco | 20 GB SSD |
| Acesso | SSH com root ou sudo |

---

## 1. Preparação do Servidor

Conecte-se à VPS via SSH:

```bash
ssh root@SEU_IP_DA_VPS
```

### 1.1. Atualizar o sistema

```bash
apt update && apt upgrade -y
```

### 1.2. Instalar dependências básicas

```bash
apt install -y curl wget git build-essential nginx certbot python3-certbot-nginx ufw
```

### 1.3. Instalar Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # deve mostrar v20.x
```

### 1.4. Instalar Yarn

```bash
corepack enable
corepack prepare yarn@stable --activate
yarn -v
```

### 1.5. Instalar PM2 (gerenciador de processos)

```bash
npm install -g pm2
pm2 startup   # configura PM2 para iniciar no boot
```

---

## 2. Configurar PostgreSQL

### 2.1. Instalar PostgreSQL 16

```bash
apt install -y postgresql postgresql-contrib
```

Se a versão disponível não for 16, adicione o repositório oficial:

```bash
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt update
apt install -y postgresql-16
```

### 2.2. Criar banco de dados e usuário

```bash
sudo -u postgres psql
```

Dentro do psql, execute:

```sql
CREATE USER universal_user WITH PASSWORD 'SUA_SENHA_SEGURA';
CREATE DATABASE universal_recargas OWNER universal_user;
GRANT ALL PRIVILEGES ON DATABASE universal_recargas TO universal_user;
\q
```

### 2.3. Configurar autenticação

Edite o arquivo `pg_hba.conf`:

```bash
nano /etc/postgresql/16/main/pg_hba.conf
```

Adicione esta linha (antes das linhas existentes de `local`):

```
local   universal_recargas   universal_user   md5
host    universal_recargas   universal_user   127.0.0.1/32   md5
```

Reinicie o PostgreSQL:

```bash
systemctl restart postgresql
```

Teste a conexão:

```bash
psql -U universal_user -d universal_recargas -h localhost -W
```

---

## 3. Configurar o Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

---

## 4. Deploy da Aplicação

### 4.1. Criar diretório e clonar o repositório

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/SEU_USUARIO/SEU_REPO.git universal_recargas
cd universal_recargas
```

> **Dica:** Se o repositório for privado, configure uma chave SSH:
> ```bash
> ssh-keygen -t ed25519 -C "vps-deploy"
> cat ~/.ssh/id_ed25519.pub
> ```
> Adicione a chave pública em **GitHub > Settings > SSH Keys**.

### 4.2. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Preencha todas as variáveis. As mais importantes são:

```env
DATABASE_URL='postgresql://universal_user:SUA_SENHA@localhost:5432/universal_recargas'
NEXTAUTH_SECRET=GERE_UM_SECRET_SEGURO
NEXTAUTH_URL=https://seu-dominio.com.br
NODE_ENV=production
PORT=3005
```

Para gerar o `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 4.3. Instalar dependências e build

```bash
yarn install
npx prisma generate
npx prisma db push
yarn build
```

### 4.4. Criar diretórios de suporte

```bash
mkdir -p logs
mkdir -p storage/wa-session
```

### 4.5. Seed inicial (opcional - apenas primeira vez)

```bash
npx tsx --require dotenv/config scripts/seed.ts
```

Isso cria as contas de teste:
- `admin@universalrecargas.com` / `admin123`
- `john@doe.com` / `johndoe123`

### 4.6. Iniciar com PM2

```bash
pm2 start ecosystem.config.js
pm2 save
```

Verificar se está rodando:

```bash
pm2 status
pm2 logs universal-recargas
```

A aplicação estará acessível em `http://SEU_IP:3005`.

---

## 5. Configurar Nginx (Proxy Reverso)

### 5.1. Copiar configuração do Nginx

```bash
cp /var/www/universal_recargas/nginx/universal-recargas.conf /etc/nginx/sites-available/universal-recargas
```

### 5.2. Editar o domínio

```bash
nano /etc/nginx/sites-available/universal-recargas
```

Substitua `seu-dominio.com.br` pelo seu domínio real.

### 5.3. Ativar o site

```bash
ln -s /etc/nginx/sites-available/universal-recargas /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default   # remove o site padrão
nginx -t                                  # testa a configuração
systemctl reload nginx
```

Agora a aplicação estará acessível em `http://seu-dominio.com.br`.

---

## 6. Configurar SSL (HTTPS) com Let's Encrypt

### 6.1. Obter certificado

Certifique-se de que o DNS do domínio aponta para o IP da VPS, depois:

```bash
certbot --nginx -d seu-dominio.com.br -d www.seu-dominio.com.br
```

Siga as instruções e escolha redirecionar HTTP para HTTPS.

### 6.2. Renovação automática

O Certbot já configura a renovação automática. Para testar:

```bash
certbot renew --dry-run
```

### 6.3. Atualizar NEXTAUTH_URL

```bash
nano /var/www/universal_recargas/.env
```

Altere `NEXTAUTH_URL` para usar `https://`:

```env
NEXTAUTH_URL=https://seu-dominio.com.br
```

Reinicie a aplicação:

```bash
cd /var/www/universal_recargas
pm2 restart universal-recargas
```

---

## 7. Deploys Futuros (Atualizações)

Para atualizar a aplicação após fazer push no GitHub:

```bash
cd /var/www/universal_recargas
bash deploy.sh
```

O script `deploy.sh` faz tudo automaticamente:
1. Puxa as mudanças do Git
2. Instala dependências
3. Gera o Prisma Client
4. Aplica mudanças no banco
5. Faz o build
6. Reinicia o PM2

---

## 8. Comandos Úteis

### PM2

```bash
pm2 status                        # status dos processos
pm2 logs universal-recargas       # logs em tempo real
pm2 logs universal-recargas --lines 100  # últimas 100 linhas
pm2 restart universal-recargas    # reiniciar
pm2 stop universal-recargas       # parar
pm2 delete universal-recargas     # remover
pm2 monit                         # monitor interativo
```

### Nginx

```bash
nginx -t                          # testar configuração
systemctl reload nginx            # recarregar
systemctl restart nginx           # reiniciar
tail -f /var/log/nginx/error.log  # logs de erro
```

### PostgreSQL

```bash
systemctl status postgresql       # status
sudo -u postgres psql             # console do postgres
psql -U universal_user -d universal_recargas -h localhost  # conectar ao banco
```

### Prisma

```bash
npx prisma studio                 # interface web para o banco (dev)
npx prisma db push                # sincronizar schema
npx prisma migrate deploy         # aplicar migrações em produção
```

---

## 9. Solução de Problemas

### A aplicação não inicia

```bash
pm2 logs universal-recargas --lines 50
```

Verifique se o `.env` está correto e se o PostgreSQL está rodando.

### Erro de conexão com o banco

```bash
systemctl status postgresql
psql -U universal_user -d universal_recargas -h localhost -W
```

### Erro 502 Bad Gateway no Nginx

A aplicação não está rodando. Verifique:

```bash
pm2 status
pm2 restart universal-recargas
```

### Permissões

Se tiver problemas de permissão:

```bash
chown -R $USER:$USER /var/www/universal_recargas
```

### Memória insuficiente (VPS com 1GB)

Crie um swap file:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Resumo Rápido (Checklist)

- [ ] VPS com Ubuntu 22.04+
- [ ] Node.js 20 LTS instalado
- [ ] Yarn instalado
- [ ] PM2 instalado e configurado
- [ ] PostgreSQL 16 rodando com banco e usuário criados
- [ ] Firewall configurado (SSH + Nginx)
- [ ] Repositório clonado em `/var/www/universal_recargas`
- [ ] `.env` configurado com dados de produção
- [ ] `yarn install && yarn build` executados
- [ ] `npx prisma db push` executado
- [ ] PM2 rodando a aplicação
- [ ] Nginx configurado como proxy reverso
- [ ] SSL (HTTPS) configurado com Let's Encrypt
- [ ] `NEXTAUTH_URL` usando `https://`
- [ ] DNS do domínio apontando para o IP da VPS
