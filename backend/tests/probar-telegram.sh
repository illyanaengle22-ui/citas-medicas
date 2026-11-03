#!/bin/bash
# ============================================================================
# Prueba de la vinculación de Telegram (RN-116) y de su idempotencia.
#
# Contexto: n8n puede reiniciarse y perder la memoria de qué chats ya vinculó.
# La fuente de verdad es `pacientes.telegram_chat_id`, así que:
#   · POST /api/telegram/vincular responde 200 "Ya vinculado" si el chat ya
#     está en la BD (aunque el código falte, sea inválido o ya se haya usado).
#   · GET /api/telegram/estado/:chatId dice si un chat está vinculado.
#
# Uso:
#   ADMIN='<token>' [BASE_URL=http://localhost:4000] \
#   [N8N_WEBHOOK_SECRET=tu-secreto] bash backend/tests/probar-telegram.sh
#
# `N8N_WEBHOOK_SECRET` debe coincidir con el del backend (por defecto
# `tu-secreto`, el mismo valor del flujo n8n del repositorio).
#
# Crea sus propios pacientes y los elimina al terminar. El chat de prueba es
# único en cada corrida para no chocar con el índice único de `pacientes`.
# ============================================================================

set -u

BASE_URL="${BASE_URL:-http://localhost:4000}"
BASE_URL="${BASE_URL%/}"
API="$BASE_URL/api"
SECRET="${N8N_WEBHOOK_SECRET:-tu-secreto}"

if [ -z "${ADMIN:-}" ]; then
  echo "❌ Falta el token de administrador."
  echo "   Uso: ADMIN='<token>' [BASE_URL=http://localhost:4000] \\"
  echo "        [N8N_WEBHOOK_SECRET=tu-secreto] bash backend/tests/probar-telegram.sh"
  exit 2
fi

ok=0
fail=0
S="$(date +%s)_$RANDOM"
# Telegram admite ids negativos; se usa uno positivo y único por corrida.
CHAT="99$(date +%s)${RANDOM}"
CHAT2="98$(date +%s)${RANDOM}"

A=(-H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json")
W=(-H "x-webhook-secret: $SECRET" -H "Content-Type: application/json")

PAC1_USER_ID=""
PAC1_ID=""
PAC2_USER_ID=""
PAC2_ID=""

check() { # descripción, esperado, obtenido
  if [ "$2" = "$3" ]; then
    echo "✅ $1"
    ok=$((ok + 1))
  else
    echo "❌ $1 (esperado: $2, obtuvo: $3)"
    fail=$((fail + 1))
  fi
}

code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
body() { curl -s "$@"; }

# Deja en RESP_BODY el cuerpo y en RESP_CODE el código HTTP de una petición.
request() {
  local salida
  salida="$(curl -s -w $'\n%{http_code}' "$@")"
  RESP_CODE="${salida##*$'\n'}"
  RESP_BODY="${salida%$'\n'*}"
}

vincular() { # chatId, [codigo]
  if [ $# -ge 2 ]; then
    request "${W[@]}" -X POST "$API/telegram/vincular" \
      -d "{\"chatId\":\"$1\",\"codigo\":\"$2\"}"
  else
    request "${W[@]}" -X POST "$API/telegram/vincular" -d "{\"chatId\":\"$1\"}"
  fi
}

get_paciente_id() { # usuario_id
  body "${A[@]}" "$API/pacientes" 2>/dev/null \
    | jq -r --arg uid "$1" '.data[]? | select((.usuario_id | tostring) == $uid) | .id' \
    | head -n 1
}

crear_paciente() { # sufijo → imprime "usuario_id|paciente_id|token"
  local email="telegram_$1_$S@test.com"
  local uid pid tok
  uid="$(body "${A[@]}" -X POST "$API/usuarios" \
    -d "{\"nombre\":\"Telegram $1 $S\",\"email\":\"$email\",\"password\":\"password123\",\"rol_id\":3}" \
    | jq -r '.data.id // empty' 2>/dev/null)"
  pid="$(get_paciente_id "$uid")"
  tok="$(body -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}" \
    | jq -r '.data.token // empty' 2>/dev/null)"
  printf '%s|%s|%s' "$uid" "$pid" "$tok"
}

cleanup() {
  for pid in "${PAC1_ID:-}" "${PAC2_ID:-}"; do
    if [ -n "$pid" ]; then
      code "${A[@]}" -X DELETE "$API/pacientes/$pid" >/dev/null 2>&1 || true
    fi
  done
  for uid in "${PAC1_USER_ID:-}" "${PAC2_USER_ID:-}"; do
    if [ -n "$uid" ]; then
      code "${A[@]}" -X DELETE "$API/usuarios/$uid" >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT

echo "== Pacientes de prueba =="
IFS='|' read -r PAC1_USER_ID PAC1_ID P1 <<<"$(crear_paciente p1)"
check "Paciente 1 creado" true "$([ -n "$PAC1_ID" ] && [ -n "$P1" ] && echo true || echo false)"
IFS='|' read -r PAC2_USER_ID PAC2_ID P2 <<<"$(crear_paciente p2)"
check "Paciente 2 creado" true "$([ -n "$PAC2_ID" ] && [ -n "$P2" ] && echo true || echo false)"
if [ -z "$PAC1_ID" ] || [ -z "$PAC2_ID" ] || [ -z "$P1" ] || [ -z "$P2" ]; then
  echo "❌ No se pudieron crear los pacientes; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi
echo "   chat 1: $CHAT"
echo "   chat 2: $CHAT2"

echo
echo "== (a) Vinculación normal =="
request -H "Authorization: Bearer $P1" -X POST "$API/telegram/codigo"
COD1="$(printf '%s' "$RESP_BODY" | jq -r '.data.codigo // empty' 2>/dev/null)"
check "POST /telegram/codigo → 200" 200 "$RESP_CODE"
check "Código de 6 caracteres" true \
  "$(printf '%s' "$COD1" | grep -Eq '^[A-Z0-9]{6}$' && echo true || echo false)"

vincular "$CHAT" "$COD1"
check "Vincular chat 1 → 200" 200 "$RESP_CODE"
check "Mensaje de vinculación" "Cuenta vinculada correctamente" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.mensaje // empty' 2>/dev/null)"
check "Devuelve JWT del paciente" "string" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.token | type' 2>/dev/null)"
check "Devuelve paciente_id" "$PAC1_ID" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.paciente_id // empty' 2>/dev/null)"

echo
echo "== (b) GET /telegram/estado/:chatId =="
request "${W[@]}" "$API/telegram/estado/$CHAT"
check "Estado chat 1 → 200" 200 "$RESP_CODE"
check "vinculado = true" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.vinculado == true' 2>/dev/null)"
check "paciente_id del chat 1" "$PAC1_ID" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.paciente_id // empty' 2>/dev/null)"
check "También viaja dentro de data" "$PAC1_ID" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.paciente_id // empty' 2>/dev/null)"

request "${W[@]}" "$API/telegram/estado/123456789"
check "Chat desconocido → 200" 200 "$RESP_CODE"
check "Chat desconocido → vinculado = false" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.vinculado == false' 2>/dev/null)"
check "Chat desconocido → paciente_id = null" null \
  "$(printf '%s' "$RESP_BODY" | jq -r '.paciente_id' 2>/dev/null)"

check "Estado sin secreto → 401" 401 "$(code "$API/telegram/estado/$CHAT")"
check "Estado con chatId inválido → 400" 400 \
  "$(code "${W[@]}" "$API/telegram/estado/abc")"

echo
echo "== (c) Idempotencia: n8n se reinició y el chat ya está en la BD =="
vincular "$CHAT" "$COD1"
check "Reintento con el mismo código → 200" 200 "$RESP_CODE"
check "Reintento → 'Ya vinculado'" "Ya vinculado" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.mensaje // empty' 2>/dev/null)"
check "Reintento devuelve JWT" "string" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.token | type' 2>/dev/null)"

vincular "$CHAT"
check "Sin código estando vinculado → 200" 200 "$RESP_CODE"
check "Sin código estando vinculado → 'Ya vinculado'" "Ya vinculado" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.mensaje // empty' 2>/dev/null)"

vincular "$CHAT" "ZZZZZZ"
check "Código inexistente estando vinculado → 200" 200 "$RESP_CODE"
check "Código inexistente → 'Ya vinculado'" "Ya vinculado" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.mensaje // empty' 2>/dev/null)"

vincular "$CHAT" "ABC"
check "Código inválido estando vinculado → 200" 200 "$RESP_CODE"
check "Código inválido → 'Ya vinculado'" "Ya vinculado" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.mensaje // empty' 2>/dev/null)"

request -H "Authorization: Bearer $P1" -X POST "$API/telegram/codigo"
COD1B="$(printf '%s' "$RESP_BODY" | jq -r '.data.codigo // empty' 2>/dev/null)"
vincular "$CHAT" "$COD1B"
check "Código nuevo estando vinculado → 200" 200 "$RESP_CODE"
check "Código nuevo estando vinculado → 'Ya vinculado'" "Ya vinculado" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.mensaje // empty' 2>/dev/null)"

check "Vincular sin secreto → 401" 401 \
  "$(code -H 'Content-Type: application/json' -X POST "$API/telegram/vincular" \
     -d "{\"chatId\":\"$CHAT\",\"codigo\":\"$COD1B\"}")"

echo
echo "== (d) Token por chat =="
request "${W[@]}" -X POST "$API/telegram/token" -d "{\"chatId\":\"$CHAT\"}"
check "POST /telegram/token → 200" 200 "$RESP_CODE"
check "Token para el paciente 1" "$PAC1_ID" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.pacienteId // empty' 2>/dev/null)"

echo
echo "== (e) Un chat pertenece a un solo paciente (RN-051) =="
request -H "Authorization: Bearer $P2" -X POST "$API/telegram/codigo"
COD2="$(printf '%s' "$RESP_BODY" | jq -r '.data.codigo // empty' 2>/dev/null)"
vincular "$CHAT" "$COD2"
check "Paciente 2 con el chat del paciente 1 → 200" 200 "$RESP_CODE"
check "Responde 'Ya vinculado'" "Ya vinculado" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.mensaje // empty' 2>/dev/null)"
check "El chat sigue siendo del paciente 1" "$PAC1_ID" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.paciente_id // empty' 2>/dev/null)"

vincular "$CHAT2" "$COD2"
check "Paciente 2 con su propio chat → 200" 200 "$RESP_CODE"
check "Paciente 2 vinculado a su chat" "$PAC2_ID" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.paciente_id // empty' 2>/dev/null)"
request "${W[@]}" "$API/telegram/estado/$CHAT2"
check "Estado chat 2 → vinculado" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.vinculado == true' 2>/dev/null)"

echo
echo "== (f) Desvincular desde la webapp (JWT del paciente) =="
# Un código pendiente no debe sobrevivir a la desvinculación.
request -H "Authorization: Bearer $P1" -X POST "$API/telegram/codigo"
COD1C="$(printf '%s' "$RESP_BODY" | jq -r '.data.codigo // empty' 2>/dev/null)"

request -H "Authorization: Bearer $P1" -X DELETE "$API/telegram/vincular"
check "DELETE /telegram/vincular (JWT) → 200" 200 "$RESP_CODE"
check "Mensaje de desvinculación" "Cuenta desvinculada" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.mensaje // empty' 2>/dev/null)"
check "desvinculado = true" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.desvinculado == true' 2>/dev/null)"

request "${W[@]}" "$API/telegram/estado/$CHAT"
check "Tras desvincular, vinculado = false" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.vinculado == false' 2>/dev/null)"

check "POST /telegram/token sin vínculo → 404" 404 \
  "$(code "${W[@]}" -X POST "$API/telegram/token" -d "{\"chatId\":\"$CHAT\"}")"

vincular "$CHAT" "$COD1C"
check "El código pendiente quedó invalidado → 400" 400 "$RESP_CODE"

request -H "Authorization: Bearer $P1" -X DELETE "$API/telegram/vincular"
check "Desvincular de nuevo → 200 (idempotente)" 200 "$RESP_CODE"
check "desvinculado = false" false \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.desvinculado' 2>/dev/null)"

check "DELETE /telegram/vincular sin JWT → 401" 401 \
  "$(code -X DELETE "$API/telegram/vincular")"
check "DELETE /telegram/vincular con JWT admin → 403" 403 \
  "$(code "${A[@]}" -X DELETE "$API/telegram/vincular")"

echo
echo "== (g) Desvincular un chat desde n8n (secreto) =="
request -H "Authorization: Bearer $P1" -X POST "$API/telegram/codigo"
COD1D="$(printf '%s' "$RESP_BODY" | jq -r '.data.codigo // empty' 2>/dev/null)"
vincular "$CHAT" "$COD1D"
check "Re-vincular el chat 1 → 200" 200 "$RESP_CODE"
check "Re-vinculado al paciente 1" "$PAC1_ID" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.paciente_id // empty' 2>/dev/null)"

request "${W[@]}" -X DELETE "$API/telegram/vincular/$CHAT"
check "DELETE /telegram/vincular/:chatId → 200" 200 "$RESP_CODE"
check "desvinculado = true" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.desvinculado == true' 2>/dev/null)"

request "${W[@]}" "$API/telegram/estado/$CHAT"
check "El chat quedó libre" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.vinculado == false' 2>/dev/null)"

request "${W[@]}" -X DELETE "$API/telegram/vincular/$CHAT"
check "Desvincular el mismo chat otra vez → 200" 200 "$RESP_CODE"
check "desvinculado = false" false \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.desvinculado' 2>/dev/null)"

check "DELETE sin secreto → 401" 401 \
  "$(code -X DELETE "$API/telegram/vincular/$CHAT")"
check "DELETE con chatId inválido → 400" 400 \
  "$(code "${W[@]}" -X DELETE "$API/telegram/vincular/abc")"

echo
echo "Resultado: $ok ✅  $fail ❌"
if [ "$fail" -gt 0 ]; then
  exit 1
fi
exit 0
