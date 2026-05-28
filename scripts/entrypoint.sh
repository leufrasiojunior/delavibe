#!/bin/sh
# Entrypoint do container do app:
# 1. Valida env vars (estoura claro se faltar)
# 2. Aplica migrations pendentes contra o banco apontado por DATABASE_URL
# 3. Inicia o servidor Next.js (PID 1 via exec)
#
# Seed NAO roda automaticamente — execute manualmente quando preciso:
#   docker compose exec app npm run db:seed
set -e

echo "[entrypoint] Validando variaveis de ambiente..."
npx tsx scripts/validate-env.ts

echo "[entrypoint] Aplicando migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[entrypoint] Iniciando o servidor Next.js..."
exec npm run start
