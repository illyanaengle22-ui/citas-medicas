#!/usr/bin/env bash
# ==============================================================================
# MediCitas — Despliegue de Backend (EC2 Ubuntu)
# ==============================================================================
set -euo pipefail

# Parámetros obligatorios
DB_HOST="${1:-${DB_HOST:-}}"
N8N_HOST="${2:-${N8N_HOST:-}}"

if [ -z "$DB_HOST" ] || [ -z "$N8N_HOST" ]; then
  echo "❌ Uso: bash deploy/deploy-back.sh <IP_PRIVADA_BD> <IP_PRIVADA_N8N>"
  echo "   O define las variables de entorno DB_HOST y N8N_HOST."
  exit 1
fi

# Variables de entorno secretas requeridas
DB_PASSWORD="${DB_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
N8N_WEBHOOK_SECRET="${N8N_WEBHOOK_SECRET:-}"

if [ -z "$DB_PASSWORD" ] || [ -z "$JWT_SECRET" ] || [ -z "$N8N_WEBHOOK_SECRET" ]; then
  echo "❌ Error: Las siguientes variables de entorno deben estar definidas:"
  echo "   - DB_PASSWORD"
  echo "   - JWT_SECRET"
  echo "   - N8N_WEBHOOK_SECRET"
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "🔹 [1/5] Instalando Node.js 22 y PM2..."
export DEBIAN_FRONTEND=noninteractive
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  sudo apt-get update -y
  sudo apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "🔹 [2/5] Instalando dependencias de producción..."
# Creamos la carpeta de uploads con permisos adecuados
mkdir -p "$APP_DIR/uploads"
chmod 755 "$APP_DIR/uploads"

# Solo svg-captcha y dependencias de ejecución; NO npm ci
npm install --omit=dev

echo "🔹 [3/5] Generando configuración de entorno (.env)..."
cat <<EOF > "$APP_DIR/.env"
PORT=4000
NODE_ENV=production
ALLOW_TEST_CAPTCHA=false

DB_HOST=$DB_HOST
DB_PORT=5432
DB_USER=citas_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=citas_medicas

JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=8h
CAPTCHA_TTL_MS=300000
APP_TIMEZONE=America/Mexico_City
UPLOADS_DIR=$APP_DIR/uploads

N8N_WEBHOOK_URL=http://${N8N_HOST}:5678/webhook/recordatorios
N8N_WEBHOOK_SECRET=$N8N_WEBHOOK_SECRET
REMINDERS_ENABLED=true
REMINDERS_INTERVAL_MS=300000
EOF

chmod 600 "$APP_DIR/.env"

echo "🔹 [4/5] Iniciando aplicación con PM2 (Modo Fork, 1 instancia)..."
pm2 delete api 2>/dev/null || true
pm2 start dist/server.js --name api --cwd "$APP_DIR" --env production
pm2 save

echo "🔹 [5/5] Verificando salud del backend..."
sleep 3
if curl -s -f http://127.0.0.1:4000/api/health >/dev/null; then
  echo "✅ Backend activo y saludable:"
  curl -s http://127.0.0.1:4000/api/health
  echo ""
else
  echo "❌ Error: El backend no respondió satisfactoriamente en /api/health."
  pm2 logs api --lines 20 --nostream
  exit 1
fi

echo "   Estado de PM2:"
pm2 status
