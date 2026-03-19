# Universal Recargas (Admin)

Painel administrativo em **Next.js 14** para gestão de recargas, pedidos, clientes e integrações de pagamento/WhatsApp.

## Pré-requisitos

- Node.js 20+
- Yarn
- PostgreSQL 16 em execução

## 1) Configurar variáveis de ambiente

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Depois ajuste os valores reais (DB, segredos, tokens e provedores de pagamento).

## 2) Instalar dependências

```bash
yarn install
```

## 3) Banco de dados (Prisma)

```bash
npx prisma generate
npx prisma db push
```

Opcional (popular dados de teste):

```bash
npx tsx --require dotenv/config scripts/seed.ts
```

## 4) Rodar projeto

```bash
yarn dev
```

Acesse: `http://localhost:3000`

## Atalho para reativar rapidamente

Se você precisa "colocar o projeto ativo novamente" em uma máquina nova, execute:

```bash
yarn reactivate
```

Esse comando:
- cria `.env` a partir de `.env.example` (se necessário);
- roda `prisma generate`;
- roda `prisma db push`;
- inicia o app com `yarn dev`.

Opcionalmente, para semear dados de teste:

```bash
SEED=1 yarn reactivate
```

## Comandos úteis

```bash
yarn dev
# roda em desenvolvimento

yarn build
# build de produção (com type-check)

yarn start
# sobe build de produção
```

## Credenciais de teste (seed)

- `admin@universalrecargas.com` / `admin123`
- `john@doe.com` / `johndoe123`

## Observações importantes

- Sem `DATABASE_URL` válido, as rotas que usam Prisma falham.
- `NEXTAUTH_URL` deve apontar para `http://localhost:3000` em ambiente local.
- Se quiser validar apenas boot do app, `yarn dev` sobe mesmo sem DB, mas APIs protegidas não irão responder corretamente.
