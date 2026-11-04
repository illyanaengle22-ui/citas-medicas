#!/bin/bash
# ============================================================================
# MediCitas — despliegue de producción
#
# Hace, en orden:
#   1. instala dependencias del backend (sin devDependencies)
#   2. aplica migraciones pendientes
#   3. instala dependencias del frontend y genera el build con rutas relativas
#   4. copia el build a WEB_DIR (nginx)
#   5. reinicia el backend y recarga nginx si están instalados
#
# Uso:
#   bash deploy/deploy.sh
#
# Variables opcionales:
#   APP_DIR=/opt/medicitas      raíz del proyecto (por defecto, la del script)
#   WEB_DIR=/var/www/medicitas  destino del build
#   SERVICE=medicitas           unidad systemd del backend
#   RUN_MIGRATIONS=0            omite las migraciones
#   SUDO=sudo                   comando de elevación (vacío si ya eres root)
#
# Antes de la primera ejecución revisa:
#   · backend/src/.env (DB, JWT_SECRET, TELEGRAM_*, N8N_*, UPLOADS_DIR)
#   · deploy/nginx/medicitas.conf (server_name, root)
#   · deploy/systemd/medicitas.service (rutas y usuario)
# ============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${APP_DIR:-$REPO_DIR}"
WEB_DIR="${WEB_DIR:-/var/www/medicitas}"
SERVICE="${SERVICE:-medicitas}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO="${SUDO:-}"
else
  SUDO="${SUDO:-sudo}"
fi

if [ -z "$WEB_DIR" ] || [ "$WEB_DIR" = "/" ]; then
  echo "❌ WEB_DIR inválido: '$WEB_DIR'"
  exit 1
fi

if [ ! -f "$APP_DIR/backend/src/.env" ]; then
  echo "❌ Falta $APP_DIR/backend/src/.env"
  echo "   Copia backend/src/.env.example y complétalo antes de desplegar."
  exit 1
fi

echo "== 1/5 · Backend: dependencias =="
cd "$APP_DIR/backend"
npm ci --omit=dev

if [ "$RUN_MIGRATIONS" = "1" ]; then
  echo
  echo "== 2/5 · Base de datos: migraciones =="
  npm run db:migrate
else
  echo
  echo "== 2/5 · Migraciones omitidas (RUN_MIGRATIONS=0) =="
fi

echo
echo "== 3/5 · Frontend: dependencias y build =="
cd "$APP_DIR/frontend"
npm ci
# Las rutas /api y /uploads son relativas; nginx las resuelve en el mismo
# dominio. No fijamos VITE_API_URL para no hornear localhost en el build.
VITE_API_URL= npm run build

echo
echo "== 4/5 · Copiando build a $WEB_DIR =="
$SUDO mkdir -p "$WEB_DIR"
if command -v rsync >/dev/null 2>&1; then
  $SUDO rsync -a --delete "$APP_DIR/frontend/dist/" "$WEB_DIR/"
else
  $SUDO rm -rf "${WEB_DIR:?}"/*
  $SUDO cp -a "$APP_DIR/frontend/dist/." "$WEB_DIR/"
fi

echo
echo "== 5/5 · Servicios =="
if command -v systemctl >/dev/null 2>&1 \
   && systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE}\.service"; then
  $SUDO systemctl restart "$SERVICE"
  echo "✅ Backend reiniciado ($SERVICE)"
else
  echo "⚠️  No se encontró ${SERVICE}.service; reinicia el backend manualmente."
fi

if command -v nginx >/dev/null 2>&1; then
  $SUDO nginx -t
  $SUDO systemctl reload nginx 2>/dev/null || $SUDO nginx -s reload
  echo "✅ nginx recargado"
else
  echo "⚠️  nginx no está instalado; instala la configuración de deploy/nginx/."
fi

echo
echo "✅ Despliegue terminado."
echo "   Frontend: $WEB_DIR"
echo "   Backend:  http://127.0.0.1:${PORT:-4000}/api/health"
echo
echo "Primera vez en un servidor nuevo:"
echo "  1. Copia deploy/systemd/medicitas.service a /etc/systemd/system/ y habilítalo."
echo "  2. Copia deploy/nginx/medicitas.conf a /etc/nginx/sites-available/ y enlázalo."
echo "  3. Crea el admin con: cd backend && npm run db:seed"
