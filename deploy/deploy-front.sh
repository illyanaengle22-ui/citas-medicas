#!/usr/bin/env bash
# ==============================================================================
# MediCitas — Despliegue de Frontend Nginx (EC2 Ubuntu)
# ==============================================================================
set -euo pipefail

BACKEND_IP="${1:-${BACKEND_IP:-}}"

if [ -z "$BACKEND_IP" ]; then
  echo "❌ Uso: bash deploy/deploy-front.sh <IP_PRIVADA_BACKEND>"
  echo "   O define la variable de entorno BACKEND_IP."
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="/var/www/app"

echo "🔹 [1/4] Instalando y asegurando Nginx..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y nginx

echo "🔹 [2/4] Desplegando archivos estáticos compilados..."
sudo rm -rf "$WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo cp -r "$APP_DIR/dist/"* "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"
sudo chmod -R 755 "$WEB_ROOT"

echo "🔹 [3/4] Inyectando IP del backend ($BACKEND_IP) en Nginx..."
TEMPLATE_FILE="$APP_DIR/deploy/nginx/app.conf.template"
if [ ! -f "$TEMPLATE_FILE" ]; then
  TEMPLATE_FILE="$(pwd)/deploy/nginx/app.conf.template"
fi

sudo sed "s/__BACKEND_IP__/$BACKEND_IP/g" "$TEMPLATE_FILE" | sudo tee /etc/nginx/sites-available/medicitas > /dev/null

# Desactivar default y activar medicitas
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/medicitas /etc/nginx/sites-enabled/medicitas

echo "🔹 [4/4] Verificando sintaxis y reiniciando Nginx..."
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "✅ Frontend desplegado correctamente en el puerto 80."
echo "   Prueba local:"
curl -s -I http://127.0.0.1/ | head -n 5
