#!/usr/bin/env bash
# ==============================================================================
# MediCitas — Prueba de Humo de Despliegue Integral
# ==============================================================================
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"

if [ -z "$BASE_URL" ]; then
  echo "❌ Uso: bash deploy/humo.sh <URL_FRONTEND_O_BACKEND>"
  echo "   Ejemplo: bash deploy/humo.sh http://54.123.45.67"
  exit 1
fi

# Elimina slash final si existe
BASE_URL="${BASE_URL%/}"

echo "=========================================================="
echo "  🧪 Ejecutando Pruebas de Humo en: $BASE_URL"
echo "=========================================================="

echo -n "1. Verificando /api/health ... "
HEALTH_RESP=$(curl -s -f "$BASE_URL/api/health" || echo "")
if echo "$HEALTH_RESP" | grep -q '"ok":true'; then
  echo "✅ OK"
else
  echo "❌ FALLÓ: $HEALTH_RESP"
  exit 1
fi

echo -n "2. Autenticando Administrador inicial (admin@clinica.com) ... "
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@clinica.com\",\"password\":\"$ADMIN_PASSWORD\"}" || echo "")

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo "")

if [ -n "$TOKEN" ]; then
  echo "✅ OK (Token obtenido)"
else
  echo "❌ FALLÓ: $LOGIN_RESP"
  exit 1
fi

echo -n "3. Consultando /api/especialidades con JWT ... "
ESP_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/especialidades" || echo "")
if echo "$ESP_RESP" | grep -q '"ok":true'; then
  echo "✅ OK"
else
  echo "❌ FALLÓ: $ESP_RESP"
  exit 1
fi

echo -n "4. Consultando /api/medicos con JWT ... "
MED_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/medicos" || echo "")
if echo "$MED_RESP" | grep -q '"ok":true'; then
  echo "✅ OK"
else
  echo "❌ FALLÓ: $MED_RESP"
  exit 1
fi

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  echo -n "5. Verificando Webhook de Telegram hacia Ngrok ... "
  TG_RESP=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" || echo "")
  if echo "$TG_RESP" | grep -q "willpower-trio-dominion.ngrok-free.dev"; then
    echo "✅ OK (Registrado en Ngrok)"
  else
    echo "⚠️ Advertencia: No coincide el dominio en el webhook de Telegram."
    echo "   Detalle: $TG_RESP"
  fi
fi

echo "=========================================================="
echo "  🎉 Todas las comprobaciones de humo fueron exitosas."
echo "=========================================================="
