# Dela's Vibe PDV

PDV local com comandas, baixa automática de estoque, histórico de vendas e base pronta para dashboard futuro.

## Stack

- Next.js 16
- React 19
- Prisma 7
- PostgreSQL 16
- Docker Compose

## Principais pontos

- Login com sessão em cookie `HttpOnly` e proteção CSRF.
- Backend valida toda entrada com `zod` e recalcula regras críticas no servidor.
- Frontend valida respostas da API antes de aceitar dados no estado da UI.
- Cada venda em comanda reduz estoque e gera movimentação auditável.
- Cancelamentos e remoções recompõem saldo com rastreabilidade.

## Subir com Docker

As variáveis do ambiente Docker já estão embutidas no `docker-compose.yml`.

Na primeira inicialização do banco, rode:

```bash
npm run init
```

Esse comando:

- sobe o banco
- aplica as migrations
- roda o `seed` inicial
- sobe a aplicação

Depois da primeira inicialização, o uso normal passa a ser:

```bash
npm run up
```

Esse comando sobe `db`, `migrate` e `app`, mas não executa o `seed`.

Se quiser subir vendo os logs no terminal:

```bash
npm run up:logs
```

Se o serviço de migração falhar, veja o erro detalhado com:

```bash
npm run logs:migrate
```

Se quiser rodar o seed manualmente no futuro:

```bash
npm run seed:manual
```

Se quiser rodar só as migrations manualmente:

```bash
npm run migrate:manual
```

### Serviços no Compose

- `db`: PostgreSQL com volume persistente.
- `migrate`: aplica migrations.
- `seed`: roda o seed inicial apenas quando chamado explicitamente.
- `app`: sobe o Next.js já compilado.

## Acesso inicial

- URL do PDV: `http://localhost:3010`
- PostgreSQL exposto em: `localhost:5433`
- Usuário: `admin`
- Senha: `TroqueEstaSenha`
- Essas credenciais iniciais ficam fixadas no seed com hash no código, não no `.env`.
- Para acesso local por IP e HTTP, o Compose já deixa `SESSION_COOKIE_SECURE=false`.
- Se futuramente você publicar com HTTPS, altere `SESSION_COOKIE_SECURE` para `true`.

## Desenvolvimento local

Como o projeto é full-stack em Next.js, `frontend` e `backend` já sobem juntos no mesmo processo:

- para `npm run dev` fora do Docker, use `DATABASE_URL` apontando para `localhost:5433`
- o hostname `db` funciona só dentro da rede do Compose

```bash
npm install
npx prisma generate
npm run dev
```

## Verificações executadas

```bash
npm test
npm run build
```

## Transferir Para Outro PC

### Levar só as imagens Docker e subir com Compose

No PC atual:

```bash
npm run images:build
npm run images:export
```

Transfira para o outro PC:

- `delavibe-images.tar`
- [docker-compose.yml](/home/leonald/pessoal/delavibe/docker-compose.yml)

No outro PC:

```bash
docker pull postgres:16-bookworm
docker load -i delavibe-images.tar
docker compose up -d db migrate seed app
```

Depois da primeira inicialização:

```bash
docker compose up -d db migrate app
```

Se quiser usar os scripts do projeto em vez dos comandos diretos, transfira a pasta do projeto também e rode:

```bash
docker pull postgres:16-bookworm
npm run images:import
npm run init
```

Depois:

```bash
npm run up
```

### Levar só o projeto e subir do zero

No PC atual:

```bash
tar --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='tsconfig.tsbuildinfo' -czf delavibe-pdv-transfer.tar.gz .
```

No outro PC:

```bash
tar -xzf delavibe-pdv-transfer.tar.gz
cd delavibe
npm run init
```

Depois, nas próximas subidas:

```bash
npm run up
```

### Levar também os dados atuais do banco

No PC atual, com o projeto rodando:

```bash
docker compose exec -T db pg_dump -U delavibe -d delavibe > delavibe-backup.sql
tar --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='tsconfig.tsbuildinfo' -czf delavibe-pdv-transfer.tar.gz .
```

No outro PC:

```bash
tar -xzf delavibe-pdv-transfer.tar.gz
cd delavibe
docker compose up -d --build db
docker compose run --rm migrate
docker compose exec -T db psql -U delavibe -d delavibe < delavibe-backup.sql
docker compose up -d --build app
```

## `.env` Local

O arquivo `.env.example` continua útil apenas se você quiser rodar o projeto fora do Docker, por exemplo com `npm run dev`.

## Observações

- O ambiente Docker não pôde ser executado neste workspace porque o `docker` não está integrado à distro WSL desta sessão.
- A auditoria `npm audit --omit=dev` apontou vulnerabilidade moderada ligada ao Prisma CLI de desenvolvimento. O container final foi separado do estágio de migração para não carregar a CLI no runtime.
