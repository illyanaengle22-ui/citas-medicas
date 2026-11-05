#!/usr/bin/env bash
# ==============================================================================
# MediCitas — Despliegue de n8n + ngrok con Docker Compose (EC2 Ubuntu)
# ==============================================================================
set -euo pipefail

BACKEND_IP="${1:-${BACKEND_IP:-}}"

if [ -z "$BACKEND_IP" ]; then
  echo "❌ Uso: bash deploy/deploy-n8n.sh <IP_PRIVADA_BACKEND>"
  echo "   O define la variable de entorno BACKEND_IP."
  exit 1
fi

# Variables de entorno secretas requeridas
N8N_ENCRYPTION_KEY="${N8N_ENCRYPTION_KEY:-}"
N8N_WEBHOOK_SECRET="${N8N_WEBHOOK_SECRET:-}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
GROQ_API_KEY="${GROQ_API_KEY:-}"
NGROK_AUTHTOKEN="${NGROK_AUTHTOKEN:-}"
NGROK_DOMAIN="willpower-trio-dominion.ngrok-free.dev"

if [ -z "$N8N_ENCRYPTION_KEY" ] || [ -z "$N8N_WEBHOOK_SECRET" ] || \
   [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$GROQ_API_KEY" ] || [ -z "$NGROK_AUTHTOKEN" ]; then
  echo "❌ Error: Las siguientes variables de entorno deben estar definidas:"
  echo "   - N8N_ENCRYPTION_KEY"
  echo "   - N8N_WEBHOOK_SECRET"
  echo "   - TELEGRAM_BOT_TOKEN"
  echo "   - GROQ_API_KEY"
  echo "   - NGROK_AUTHTOKEN"
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "🔹 [1/7] Instalando Docker y Docker Compose plugin..."
export DEBIAN_FRONTEND=noninteractive
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER" 2>/dev/null || true
fi

echo "🔹 [2/7] Generando docker-compose.yml..."
cat <<EOF > "$APP_DIR/docker-compose.yml"
services:
  n8n:
    image: n8nio/n8n:2.43.7
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=https://${NGROK_DOMAIN}/
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - GENERIC_TIMEZONE=America/Mexico_City
      - TZ=America/Mexico_City
      - N8N_SECURE_COOKIE=false
      - N8N_DIAGNOSTICS_ENABLED=false
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
    volumes:
      - n8n_data:/home/node/.n8n

  ngrok:
    image: ngrok/ngrok:latest
    container_name: ngrok_tunnel
    restart: unless-stopped
    command:
      - "http"
      - "--domain=${NGROK_DOMAIN}"
      - "n8n:5678"
    environment:
      - NGROK_AUTHTOKEN=${NGROK_AUTHTOKEN}
    depends_on:
      - n8n

volumes:
  n8n_data:
EOF

echo "🔹 [3/7] Iniciando contenedores n8n y túnel ngrok..."
sudo docker compose down 2>/dev/null || true
sudo docker compose up -d

echo "   Esperando que n8n esté listo en el puerto 5678..."
for i in {1..40}; do
  if curl -s -f http://127.0.0.1:5678/healthz >/dev/null 2>&1; then
    echo "   n8n está en línea."
    break
  fi
  sleep 2
  if [ "$i" -eq 40 ]; then
    echo "❌ Error: n8n tardó demasiado en responder."
    sudo docker compose logs n8n
    exit 1
  fi
done

echo "🔹 [4/7] Preparando credenciales para n8n..."
TMP_DIR="$(mktemp -d)"
CRED_FILE="$TMP_DIR/credentials.json"

cat <<EOF > "$CRED_FILE"
[
  {
    "id": "KFYnnSeU6pUTWXsp",
    "name": "Telegram account 2",
    "type": "telegramApi",
    "data": {
      "accessToken": "${TELEGRAM_BOT_TOKEN}"
    }
  },
  {
    "id": "YRKFPAQ3VnP21gS2",
    "name": "Telegram account",
    "type": "telegramApi",
    "data": {
      "accessToken": "${TELEGRAM_BOT_TOKEN}"
    }
  },
  {
    "id": "0rN64UwQy1ud1vsm",
    "name": "Groq account",
    "type": "groqApi",
    "data": {
      "apiKey": "${GROQ_API_KEY}"
    }
  },
  {
    "id": "QXK4lQ3J4clPPY7H",
    "name": "Groq account 2",
    "type": "groqApi",
    "data": {
      "apiKey": "${GROQ_API_KEY}"
    }
  }
]
EOF

sudo docker compose cp "$CRED_FILE" n8n:/tmp/credentials.json
sudo docker compose exec -u root -T n8n chown node:node /tmp/credentials.json
sudo docker compose exec -T n8n n8n import:credentials --input=/tmp/credentials.json
sudo docker compose exec -u root -T n8n rm -f /tmp/credentials.json 2>/dev/null || true

echo "🔹 [5/7] Procesando e importando workflows de n8n..."
WORKFLOW_SRC="$APP_DIR/MediCitas.json"
WORKFLOW_TMP="$TMP_DIR/MediCitas_procesado.json"

if [ ! -f "$WORKFLOW_SRC" ]; then
  echo "❌ Error: No se encontró el archivo $WORKFLOW_SRC"
  rm -rf "$TMP_DIR"
  exit 1
fi

# Inyectamos la IP privada del backend y el secreto del webhook
sed -e "s|http://localhost:4000|http://${BACKEND_IP}:4000|g" \
    -e "s|http://host.docker.internal:4000|http://${BACKEND_IP}:4000|g" \
    -e "s|tu-secreto|${N8N_WEBHOOK_SECRET}|g" \
    "$WORKFLOW_SRC" > "$WORKFLOW_TMP"

sudo docker compose cp "$WORKFLOW_TMP" n8n:/tmp/workflow.json
sudo docker compose exec -u root -T n8n chown node:node /tmp/workflow.json
sudo docker compose exec -T n8n n8n import:workflow --input=/tmp/workflow.json
sudo docker compose exec -u root -T n8n rm -f /tmp/workflow.json 2>/dev/null || true

echo "🔹 [6/7] Activando workflows en n8n..."
# En n8n v2 publish:workflow requiere el ID del workflow (en MediCitas.json es GLIxoBsZqn5Tb9bT o 1)
sudo docker compose exec -T n8n n8n publish:workflow --id=GLIxoBsZqn5Tb9bT 2>/dev/null || \
sudo docker compose exec -T n8n n8n publish:workflow --id=1 2>/dev/null || \
sudo docker compose exec -T n8n n8n update:workflow --all --active=true 2>/dev/null || true

# Limpieza estricta de temporales con secretos en el host
rm -rf "$TMP_DIR"

# Reiniciar n8n con el túnel ngrok ya estabilizado para asegurar registro de webhooks
echo "   Reiniciando servicio n8n para asegurar registro del webhook en Telegram..."
sudo docker compose restart n8n
sleep 5

echo "🔹 [7/7] Verificando webhook de Telegram..."
WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")
REGISTRADA_URL=$(echo "$WEBHOOK_INFO" | grep -o '"url":"[^"]*' | cut -d'"' -f4 || echo "")

if echo "$REGISTRADA_URL" | grep -q "$NGROK_DOMAIN"; then
  echo "✅ Webhook de Telegram registrado exitosamente hacia https://${NGROK_DOMAIN}"
else
  echo "⚠️ Advertencia: El webhook de Telegram reporta: $REGISTRADA_URL"
  echo "   Respuesta de Telegram: $WEBHOOK_INFO"
fi

echo ""
echo "✅ Despliegue de n8n completado con éxito."
sudo docker compose ps
