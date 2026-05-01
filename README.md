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
- O primeiro administrador agora é criado no primeiro acesso em `/setup`.
- Backend valida toda entrada com `zod` e recalcula regras críticas no servidor.
- Frontend valida respostas da API antes de aceitar dados no estado da UI.
- Cada venda em comanda reduz estoque e gera movimentação auditável.
- Cancelamentos e remoções recompõem saldo com rastreabilidade.

## Ambientes Docker

- `docker-compose.yml`: desenvolvimento/local. Mantém portas locais, seed opcional e credenciais simplificadas apenas para uso local.
- `docker-compose.coolify.yml`: produção/Coolify. Usa `postgres:16-bookworm`, não publica a porta do PostgreSQL e expõe só a porta interna `3000` do app para o proxy do Coolify/Traefik.

## Subir localmente com Docker

As variáveis do ambiente Docker local continuam embutidas no `docker-compose.yml`. Esse arquivo não deve ser reutilizado como produção.

Na primeira inicialização do banco, rode:

```bash
npm run init
```

Esse comando:

- sobe o banco
- aplica as migrations
- roda o `seed` base inicial
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
- `seed`: roda o seed base apenas quando chamado explicitamente.
- `app`: sobe o Next.js já compilado.

## Acesso inicial

- URL do PDV: `http://localhost:3010`
- PostgreSQL exposto em: `localhost:5433`
- Se ainda não existir administrador no banco, o sistema redireciona automaticamente para `http://localhost:3010/setup`.
- O primeiro administrador é criado nessa tela e o fluxo é bloqueado logo após a criação.
- O seed não cria mais usuário administrador nem senha padrão.
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

Regras importantes:

- nunca commite `.env` com senhas reais
- o repositório mantém somente `.env.example` com placeholders locais
- `POSTGRES_PASSWORD=change-me-local-only` no exemplo é apenas placeholder, não uma senha de produção

## Deploy no Coolify

Use o arquivo [docker-compose.coolify.yml](/home/ubuntu/pessoal/delavibe/docker-compose.coolify.yml) para produção.

Características desse compose:

- serviços `postgres`, `migrate` e `app`
- `postgres:16-bookworm`
- volume persistente para o banco
- `healthcheck` no PostgreSQL
- `app` depende do banco saudável e das migrations concluídas
- `DATABASE_URL` aponta para `postgres:5432` na rede interna
- sem `ports` para o PostgreSQL
- `app` usa `expose: 3000`, que é a porta interna real do container confirmada no `Dockerfile`

No Coolify:

- configure `POSTGRES_PASSWORD` como variável de ambiente do serviço
- se desejar, sobrescreva `POSTGRES_USER` e `POSTGRES_DB`
- mantenha `SESSION_COOKIE_SECURE=true`
- publique o domínio no serviço `app`, apontando para a porta interna `3000`
- deixe o PostgreSQL somente na rede interna do projeto

Fluxo esperado em produção:

- o seed não cria admin padrão
- no primeiro acesso ao domínio do app, o sistema abre `/setup`
- a primeira conta criada recebe perfil `admin`
- depois disso, `/setup` passa a redirecionar para `login` ou para a área autenticada

## Seed

O seed atual é seguro para produção no sentido de não criar credenciais.

- mantém apenas dados base não sensíveis
- não contém senha hardcoded
- não cria usuário administrador
- registra movimentações iniciais de estoque sem atrelar credencial padrão

## Observações

- O ambiente Docker não pôde ser executado neste workspace porque o `docker` não está integrado à distro WSL desta sessão.
- A auditoria `npm audit --omit=dev` apontou vulnerabilidade moderada ligada ao Prisma CLI de desenvolvimento. O container final foi separado do estágio de migração para não carregar a CLI no runtime.
