# Deploy

## Arquitetura

A aplicação e o banco são deployados como **stacks separados** (em produção/homolog), mas dentro do **mesmo projeto Coolify**. A comunicação acontece via DNS interno do Coolify (não via subdomínio).

```
Projeto Coolify
├── Stack: delavibe-db       (docker-compose.db.yml)        → expõe postgres:5432 interno
└── Stack: delavibe-app      (docker-compose.coolify.yml)   → conecta via DATABASE_URL apontando pro nome interno do DB
```

### Por que separado?
- Deploy do app não toca no banco (mais seguro).
- O banco raramente reinicia; o app deploya com frequência.
- Backup, scale e versionamento do banco viram operações independentes.

## Migrations e seed

- **Migrations**: rodam automaticamente no `ENTRYPOINT` do container do app (`scripts/entrypoint.sh` → `prisma migrate deploy` → `npm run start`). Toda vez que o app sobe ele aplica migrations pendentes antes de aceitar tráfego.
- **Seed**: NÃO roda automaticamente. Execute manualmente dentro do container do app quando necessário:
  ```bash
  # local dev
  docker compose exec app npm run db:seed
  # prod (Coolify) — via terminal do container
  npm run db:seed
  ```

## Variáveis de ambiente obrigatórias (produção)

No stack **delavibe-db**:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

No stack **delavibe-app**:
- `DATABASE_URL` = `postgresql://<user>:<password>@<nome-interno-do-servico-db>:5432/<dbname>?schema=public`
  - O `<nome-interno-do-servico-db>` é o que o Coolify atribui ao serviço `postgres` do stack DB (ver na UI do Coolify).
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (gerar uma vez com `npx tsx scripts/generate-vapid-keys.ts`)
- `NEXT_PUBLIC_STORE_NAME`, `NEXT_PUBLIC_STORE_ADDRESS`, `NEXT_PUBLIC_STORE_PHONE`

## Backup do banco

Gerar dump local (rodando o cliente psql/pg_dump fora do container do DB):
```bash
docker exec <nome-container-postgres> pg_dump \
  -U $POSTGRES_USER $POSTGRES_DB > backups/delavibe-$(date +%Y%m%d-%H%M%S).sql
```

Ou usando `docker compose` em dev:
```bash
npm run db:backup
```
> Cria `backups/delavibe-<timestamp>.sql`. Crie a pasta `backups/` se ainda não existir.

## Restore

```bash
cat backups/delavibe-XXXX.sql | docker exec -i <nome-container-postgres> \
  psql -U $POSTGRES_USER -d $POSTGRES_DB
```

## Migração do setup antigo (app+db no mesmo stack) para o novo

> Roteiro recomendado para o ambiente atual em Coolify.

1. **Backup do banco em uso**:
   ```bash
   docker exec <container-postgres-atual> pg_dump -U $POSTGRES_USER $POSTGRES_DB \
     > delavibe-pre-split.sql
   ```
2. **Suba o stack novo do DB** (`docker-compose.db.yml`) no projeto Coolify com as mesmas credenciais do antigo.
3. **Restore do dump** no novo stack:
   ```bash
   cat delavibe-pre-split.sql | docker exec -i <novo-container-postgres> \
     psql -U $POSTGRES_USER -d $POSTGRES_DB
   ```
4. **Configure `DATABASE_URL`** no stack do app apontando pro novo serviço.
5. **Suba o stack novo do app** (`docker-compose.coolify.yml`). O entrypoint roda `prisma migrate deploy` automaticamente — não deve aplicar nada novo (estado já está no dump).
6. **Smoke**: `/healthz`, login admin, ver pedido existente, etc.
7. **Depois de validar**: derrubar o stack antigo (app+db unificado).

## Comandos úteis (dev local)

```bash
npm run up           # sobe db + app (migrate roda no entrypoint do app)
npm run up:build     # idem, mas com rebuild
npm run init         # sobe + roda seed
npm run down         # para tudo (mantém volumes)
npm run down:volumes # para tudo E APAGA volumes (cuidado!)
npm run seed:manual  # roda seed dentro do container do app
npm run db:backup    # dump em backups/<timestamp>.sql
npm run logs:app     # tail dos logs do app
```
