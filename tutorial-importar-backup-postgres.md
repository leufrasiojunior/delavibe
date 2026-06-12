# Tutorial: importar novamente um backup PostgreSQL do DelaVibe

Este tutorial mostra como recuperar/importar um backup real do banco PostgreSQL
quando for preciso reconstruir o ambiente, testar uma recuperacao ou restaurar
producao.

O fluxo seguro e:

```text
banco vazio -> pg_restore do dump -> migrations -> app
```

Nao restaure um dump antigo por cima de um schema novo ja migrado e com dados.
Primeiro deixe o banco alvo vazio, restaure o dump e depois aplique as migrations
da versao atual da aplicacao.

## 1. Regra para nao deixar senha no historico

Nao digite a senha real diretamente no comando.

Use uma leitura silenciosa quando precisar passar a senha para o Compose:

```bash
read -rsp "Senha do banco: " DB_PASSWORD
printf '\n'
```

Depois use `"$DB_PASSWORD"` nos comandos. O historico do shell guarda o texto
`$DB_PASSWORD`, nao a senha real digitada.

Quando terminar, limpe a variavel da sessao atual:

```bash
unset DB_PASSWORD
```

Neste tutorial, os comandos usam valores fixos nao sensiveis:

```text
database: delavibe
usuario:  delavibe
dump:     /home/ubuntu/delavibe-postgres-2026-05-26_03-00-25.dump
compose:  docker-compose.coolify.yml
```

## 2. Entenda o tipo do backup

O backup usado neste teste:

```text
/home/ubuntu/delavibe-postgres-2026-05-26_03-00-25.dump
```

E um dump custom do PostgreSQL, gerado no formato `pg_dump -Fc`.

Para esse tipo de arquivo, use:

```bash
pg_restore
```

Nao use:

```bash
psql < arquivo.dump
```

`psql < arquivo` serve para dumps SQL puros, nao para dumps custom.

## 3. URL de conexao

Para comandos executados do host local, use `127.0.0.1`:

```text
postgresql://delavibe:SENHA_DO_BANCO@127.0.0.1:5432/delavibe?schema=public
```

Para a aplicacao rodando dentro do Docker, use o nome do servico:

```text
postgresql://delavibe:SENHA_DO_BANCO@postgres:5432/delavibe?schema=public
```

Se um compose usar esta forma:

```yaml
environment:
  DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
```

voce precisa definir `DATABASE_URL` fora do arquivo. Para nao digitar a senha no
historico, monte a URL com a senha lida silenciosamente:

```bash
read -rsp "Senha do banco: " DB_PASSWORD
printf '\n'

DATABASE_URL="postgresql://delavibe:${DB_PASSWORD}@postgres:5432/delavibe?schema=public" \
docker compose -f docker-compose.coolify.yml up -d app

unset DB_PASSWORD
```

No Coolify, configure `DATABASE_URL` em Environment Variables do servico da app.
Ali a senha fica no gerenciador de variaveis/secrets do Coolify, nao em comando
do shell.

## 4. Ordem correta da recuperacao

A ordem segura e:

```text
1. parar app
2. garantir backup final, se for producao real
3. deixar banco alvo vazio
4. copiar dump para dentro do container do Postgres
5. restaurar com pg_restore
6. rodar migrations
7. validar banco
8. subir app
9. validar app
```

Nao rode seed nesse fluxo. Um backup de producao ja contem os dados reais.

## 5. Entrar no diretorio do projeto

```bash
cd /home/ubuntu/pessoal/delavibe
```

Confira os containers:

```bash
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

Neste ambiente local, os nomes esperados sao:

```text
delavibe-postgres-1
delavibe-app-1
```

Se os nomes estiverem diferentes, substitua nos comandos abaixo.

## 6. Parar a app

Antes de mexer no banco, pare a aplicacao para evitar escrita durante o restore:

```bash
docker stop delavibe-app-1
```

Se o container da app nao existir ainda, siga em frente.

Confira que o Postgres ficou ativo:

```bash
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep delavibe
```

## 7. Subir o Postgres, se necessario

Se o Postgres ainda nao estiver rodando, leia a senha sem mostra-la na tela:

```bash
read -rsp "Senha do banco: " DB_PASSWORD
printf '\n'
```

Suba somente o Postgres:

```bash
POSTGRES_PASSWORD="$DB_PASSWORD" \
docker compose -f docker-compose.coolify.yml up -d postgres
```

Confira se ficou `healthy`:

```bash
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' | grep delavibe-postgres
```

Nao limpe `DB_PASSWORD` ainda se voce vai rodar migrations ou subir a app nos
passos seguintes. Se voce for parar aqui, rode:

```bash
unset DB_PASSWORD
```

## 8. Esvaziar o banco alvo

Este passo e destrutivo para o banco alvo. Use somente no banco que voce quer
restaurar.

Como o comando roda dentro do container do Postgres, normalmente nao e preciso
passar senha. O container ja tem acesso local ao proprio banco.

Limpe o schema `public`:

```bash
docker exec -i delavibe-postgres-1 \
  psql -v ON_ERROR_STOP=1 -U delavibe -d delavibe <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION delavibe;
GRANT ALL ON SCHEMA public TO delavibe;
GRANT USAGE ON SCHEMA public TO public;
SQL
```

Valide que nao existem tabelas:

```bash
docker exec -i delavibe-postgres-1 \
  psql -U delavibe -d delavibe -c "
select count(*) as public_tables
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE';
"
```

O esperado antes do restore:

```text
public_tables = 0
```

## 9. Copiar o dump para dentro do container

Copie o arquivo do host para o container do Postgres:

```bash
docker cp /home/ubuntu/delavibe-postgres-2026-05-26_03-00-25.dump \
  delavibe-postgres-1:/tmp/prod.dump
```

Confirme que o arquivo entrou no container:

```bash
docker exec delavibe-postgres-1 ls -lh /tmp/prod.dump
```

## 10. Restaurar o dump

Restaure o dump custom com `pg_restore`:

```bash
docker exec -i delavibe-postgres-1 \
  pg_restore \
    --exit-on-error \
    --no-owner \
    --no-acl \
    -U delavibe \
    -d delavibe \
    /tmp/prod.dump
```

O que cada opcao faz:

- `--exit-on-error`: para no primeiro erro real.
- `--no-owner`: nao tenta recriar ownership original do dump.
- `--no-acl`: nao tenta restaurar permissoes/grants antigos.
- `-U`: usuario do Postgres.
- `-d`: database alvo.

Se esse comando falhar, nao continue para a app. Primeiro entenda o erro,
limpe o schema de novo se necessario e repita o restore.

## 11. Rodar migrations da aplicacao atual

Depois do restore, rode as migrations da versao atual.

Se voce ainda nao leu a senha nesta sessao, leia agora:

```bash
read -rsp "Senha do banco: " DB_PASSWORD
printf '\n'
```

Rode o servico de migration:

```bash
POSTGRES_PASSWORD="$DB_PASSWORD" \
docker compose -f docker-compose.coolify.yml run --rm migrate
```

Esse comando executa:

```bash
npm run db:migrate
```

que por sua vez roda:

```bash
prisma migrate deploy
```

O Prisma usa a tabela `_prisma_migrations` restaurada do backup para saber quais
migrations ja existiam e aplica somente as pendentes.

## 12. Validar estrutura do banco

Depois das migrations, valide a quantidade de tabelas:

```bash
docker exec -i delavibe-postgres-1 \
  psql -U delavibe -d delavibe -c "
select count(*) as public_tables
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE';
"
```

Valide constraints e indices invalidos:

```bash
docker exec -i delavibe-postgres-1 \
  psql -U delavibe -d delavibe -c "
select count(*) as invalid_fk_constraints
from pg_constraint
where contype = 'f'
  and not convalidated;

select count(*) as invalid_indexes
from pg_index
where not indisvalid;
"
```

O esperado e:

```text
invalid_fk_constraints = 0
invalid_indexes = 0
```

## 13. Validar dados principais

Rode uma contagem das tabelas principais:

```bash
docker exec -i delavibe-postgres-1 \
  psql -U delavibe -d delavibe -c "
select 'User' as table_name, count(*) from public.\"User\"
union all
select 'Product', count(*) from public.\"Product\"
union all
select 'Commanda', count(*) from public.\"Commanda\"
union all
select 'ComandaItem', count(*) from public.\"ComandaItem\"
union all
select 'Payment', count(*) from public.\"Payment\"
union all
select 'StockMovement', count(*) from public.\"StockMovement\"
union all
select 'AuditLog', count(*) from public.\"AuditLog\"
order by table_name;
"
```

Se alguma tabela nova da aplicacao atual ficar vazia, isso pode ser normal. O
backup antigo nao tinha dados dessas features. O importante e as migrations
terem criado a estrutura sem quebrar os dados antigos.

## 14. Subir a aplicacao

Depois que restore e migrations passaram, suba a app.

Se voce ainda nao leu a senha nesta sessao:

```bash
read -rsp "Senha do banco: " DB_PASSWORD
printf '\n'
```

Suba o app:

```bash
POSTGRES_PASSWORD="$DB_PASSWORD" \
docker compose -f docker-compose.coolify.yml up -d app
```

Confira o status:

```bash
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' | grep delavibe
```

Agora limpe a variavel da sessao:

```bash
unset DB_PASSWORD
```

## 15. Validar a aplicacao

Healthcheck:

```bash
curl -fsS http://127.0.0.1:3000/healthz
```

O esperado:

```text
ok
```

Depois valide no navegador:

- login do admin restaurado
- listagem de produtos
- estoque
- commandas/vendas antigas
- relatorios
- telas novas que dependem de migrations recentes

## 16. Limpar arquivo temporario

Depois de validar:

```bash
docker exec delavibe-postgres-1 rm -f /tmp/prod.dump
```

## 17. Procedimento equivalente no Coolify

Em producao real, a ordem e a mesma:

```text
parar app -> banco vazio -> pg_restore -> migrations -> app
```

No Coolify:

1. Pare o servico da aplicacao.
2. Mantenha o Postgres rodando.
3. Faca um backup final antes de apagar qualquer coisa.
4. Entre via SSH no servidor.
5. Identifique o container do Postgres:

```bash
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep postgres
```

6. Copie o dump para o servidor:

```bash
scp backup.dump usuario@servidor:/tmp/backup.dump
```

7. Copie o dump para dentro do container:

```bash
docker cp /tmp/backup.dump <container-postgres>:/tmp/prod.dump
```

8. Limpe o banco alvo:

```bash
docker exec -i <container-postgres> sh -lc '
set -eu
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION "$POSTGRES_USER";
GRANT ALL ON SCHEMA public TO "$POSTGRES_USER";
GRANT USAGE ON SCHEMA public TO public;
SQL
'
```

9. Restaure:

```bash
docker exec <container-postgres> sh -lc '
set -eu
pg_restore \
  --exit-on-error \
  --no-owner \
  --no-acl \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  /tmp/prod.dump
'
```

10. Suba/deploye a app nova para rodar migrations.

Se a app e o banco estiverem em stacks separados, a `DATABASE_URL` da app deve
apontar para o DNS interno do Postgres, nao para `127.0.0.1`:

```text
postgresql://USUARIO:SENHA@HOST_INTERNO_DO_POSTGRES:5432/NOME_DO_BANCO?schema=public
```

No Coolify, prefira cadastrar essa URL no painel de variaveis/secrets, nao em
scripts versionados.

## 18. Checklist rapido

- [ ] App parada.
- [ ] Backup final guardado fora do servidor.
- [ ] Banco alvo vazio.
- [ ] Dump copiado para o container do Postgres.
- [ ] `pg_restore --exit-on-error --no-owner --no-acl` executado sem erro.
- [ ] `prisma migrate deploy` executado sem erro.
- [ ] `invalid_fk_constraints = 0`.
- [ ] `invalid_indexes = 0`.
- [ ] Contagens das tabelas principais conferidas.
- [ ] App subida.
- [ ] `/healthz` retornando `ok`.
- [ ] Login e telas principais testados.

## 19. Rollback

Se falhar antes de liberar a app:

1. Mantenha a app parada.
2. Limpe o banco alvo de novo.
3. Restaure o backup anterior conhecido como bom.
4. Rode as migrations correspondentes a versao que sera usada.
5. Suba a app somente depois de validar.

Se a app nova ja recebeu escritas de usuarios, o rollback fica mais delicado:
voce pode precisar extrair ou conciliar dados novos antes de voltar.
