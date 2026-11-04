#!/bin/bash
# Aplica las migraciones pendientes de backend/migrations.
#
# Uso:
#   bash deploy/migrar.sh
#   bash deploy/migrar.sh --baseline   # base ya migrada antes de schema_migrations
#
# Requiere que backend/src/.env tenga DB_HOST, DB_PORT, DB_USER, DB_PASSWORD
# y DB_NAME. Se ejecuta desde backend/ para que Node resuelva pg/dotenv.

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR/backend"

if [ ! -f src/.env ]; then
  echo "❌ Falta backend/src/.env (cópialo de backend/src/.env.example)."
  exit 1
fi

npm run db:migrate -- "$@"
