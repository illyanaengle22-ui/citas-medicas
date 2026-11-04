#!/bin/bash
# ============================================================================
# Prueba del reagendamiento con cambio de médico.
#
# Verifica:
#   - propuestas de horarios para otro médico de la misma especialidad
#   - rechazo al elegir un médico de otra especialidad
#   - reagendar cambiando médico y consultorio en una sola operación
#   - rechazo de horarios fuera del horario activo (RN-072)
#   - rechazo por traslape del paciente (RN-078) al reagendar
#   - compatibilidad: reagendar sin medico_id sigue funcionando
#
# Uso:
#   ADMIN='<token>' [BASE_URL=http://localhost:4000] \
#     bash backend/tests/probar-reagendar.sh
# ============================================================================

set -u

BASE_URL="${BASE_URL:-http://localhost:4000}"
BASE_URL="${BASE_URL%/}"
API="$BASE_URL/api"
TZ_BD="${TZ_BD:-America/Mexico_City}"

if [ -z "${ADMIN:-}" ]; then
  echo "❌ Falta el token de administrador."
  echo "   Uso: ADMIN='<token>' [BASE_URL=http://localhost:4000] \\"
  echo "        bash backend/tests/probar-reagendar.sh"
  exit 2
fi

ok=0
fail=0
S="$(date +%s)_$RANDOM"

# Fecha futura (+2 días) en la zona horaria de la clínica.
FECHA="$(TZ="$TZ_BD" date -d '+2 days' +%Y-%m-%d)"
DIA_SEMANA="$(TZ="$TZ_BD" date -d "$FECHA" +%u)"
OFFSET_RAW="$(TZ="$TZ_BD" date -d "$FECHA 10:00" +%z)"
OFFSET="${OFFSET_RAW:0:3}:${OFFSET_RAW:3:2}"

A=(-H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json")

ESP_A=""
ESP_B=""
CON_ID=""
MED_A1=""
MED_A2=""
MED_B=""
PAC_USER_ID=""
PAC_ID=""
CITA_ID=""
CITA2_ID=""

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

request() {
  local salida
  salida="$(curl -s -w $'\n%{http_code}' "$@")"
  RESP_CODE="${salida##*$'\n'}"
  RESP_BODY="${salida%$'\n'*}"
}

get_paciente_id() { # usuario_id
  body "${A[@]}" "$API/pacientes" 2>/dev/null \
    | jq -r --arg uid "$1" '.data[]? | select((.usuario_id | tostring) == $uid) | .id' \
    | head -n 1
}

cleanup() {
  for cid in "${CITA_ID:-}" "${CITA2_ID:-}"; do
    if [ -n "$cid" ]; then
      code "${A[@]}" -X PUT "$API/citas/$cid/estado" \
        -d '{"estado":"cancelada","ignorarPlazo":true}' >/dev/null 2>&1 || true
    fi
  done
  if [ -n "${PAC_ID:-}" ]; then
    code "${A[@]}" -X DELETE "$API/pacientes/$PAC_ID" >/dev/null 2>&1 || true
  fi
  if [ -n "${PAC_USER_ID:-}" ]; then
    code "${A[@]}" -X DELETE "$API/usuarios/$PAC_USER_ID" >/dev/null 2>&1 || true
  fi
  for mid in "${MED_A1:-}" "${MED_A2:-}" "${MED_B:-}"; do
    if [ -n "$mid" ]; then
      code "${A[@]}" -X DELETE "$API/medicos/$mid" >/dev/null 2>&1 || true
    fi
  done
  if [ -n "${CON_ID:-}" ]; then
    code "${A[@]}" -X DELETE "$API/consultorios/$CON_ID" >/dev/null 2>&1 || true
  fi
  for eid in "${ESP_A:-}" "${ESP_B:-}"; do
    if [ -n "$eid" ]; then
      code "${A[@]}" -X PATCH "$API/especialidades/$eid/estado" \
        -d '{"activo":false}' >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT

echo "== Datos de la prueba =="
echo "   Fecha local: $FECHA (día $DIA_SEMANA), offset $OFFSET"
echo "   Sufijo:      $S"

# ── Especialidades, consultorio y médicos ───────────────────────────────────
echo
echo "== Crear especialidades, consultorio y médicos =="

request "${A[@]}" -X POST "$API/especialidades" \
  -d "{\"nombre\":\"Reagendar Esp A $S\",\"descripcion\":\"Prueba de reagendamiento\"}"
ESP_A="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Especialidad A creada" true "$([ -n "$ESP_A" ] && echo true || echo false)"

request "${A[@]}" -X POST "$API/especialidades" \
  -d "{\"nombre\":\"Reagendar Esp B $S\",\"descripcion\":\"Otra especialidad\"}"
ESP_B="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Especialidad B creada" true "$([ -n "$ESP_B" ] && echo true || echo false)"

request "${A[@]}" -X POST "$API/consultorios" \
  -d "{\"nombre\":\"Reagendar Con $S\",\"direccion\":\"Calle de prueba $S\"}"
CON_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Consultorio creado" true "$([ -n "$CON_ID" ] && echo true || echo false)"

if [ -z "$ESP_A" ] || [ -z "$ESP_B" ] || [ -z "$CON_ID" ]; then
  echo "❌ No se pudo preparar el catálogo; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

crear_medico() { # nombre, email, cedula, especialidad
  request "${A[@]}" -X POST "$API/medicos" \
    -d "{\"nombre\":\"$1\",\"email\":\"$2\",\"password\":\"password123\",\"cedula_profesional\":\"$3\",\"especialidades\":[$4],\"consultorios\":[$CON_ID]}"
  printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null
}

MED_A1="$(crear_medico "Reagendar Med A1 $S" "reagendar_a1_$S@test.com" "REA1$S" "$ESP_A")"
MED_A2="$(crear_medico "Reagendar Med A2 $S" "reagendar_a2_$S@test.com" "REA2$S" "$ESP_A")"
MED_B="$(crear_medico "Reagendar Med B $S" "reagendar_b_$S@test.com" "REB$S" "$ESP_B")"
check "Médico A1 creado" true "$([ -n "$MED_A1" ] && echo true || echo false)"
check "Médico A2 creado (misma especialidad)" true "$([ -n "$MED_A2" ] && echo true || echo false)"
check "Médico B creado (otra especialidad)" true "$([ -n "$MED_B" ] && echo true || echo false)"

if [ -z "$MED_A1" ] || [ -z "$MED_A2" ] || [ -z "$MED_B" ]; then
  echo "❌ No se pudieron crear los médicos; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

crear_horario() { # medico_id
  request "${A[@]}" -X POST "$API/horarios" \
    -d "{\"medico_id\":$1,\"consultorio_id\":$CON_ID,\"dia_semana\":$DIA_SEMANA,\"hora_inicio\":\"08:00\",\"hora_fin\":\"20:00\"}"
  printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null
}

HOR_A1="$(crear_horario "$MED_A1")"
HOR_A2="$(crear_horario "$MED_A2")"
HOR_B="$(crear_horario "$MED_B")"
check "Horario de A1 creado" true "$([ -n "$HOR_A1" ] && echo true || echo false)"
check "Horario de A2 creado" true "$([ -n "$HOR_A2" ] && echo true || echo false)"
check "Horario de B creado" true "$([ -n "$HOR_B" ] && echo true || echo false)"

# ── Paciente ────────────────────────────────────────────────────────────────
echo
echo "== Crear paciente =="

request "${A[@]}" -X POST "$API/usuarios" \
  -d "{\"nombre\":\"Reagendar Paciente $S\",\"email\":\"reagendar_pac_$S@test.com\",\"password\":\"password123\",\"rol_id\":3}"
PAC_USER_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Paciente creado" true "$([ -n "$PAC_USER_ID" ] && echo true || echo false)"

PAC_ID="$(get_paciente_id "$PAC_USER_ID")"
check "Paciente tiene registro" true "$([ -n "$PAC_ID" ] && echo true || echo false)"

request -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"reagendar_pac_$S@test.com\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}"
PAC_TOKEN="$(printf '%s' "$RESP_BODY" | jq -r '.data.token // empty' 2>/dev/null)"
check "Login del paciente" true "$([ -n "$PAC_TOKEN" ] && echo true || echo false)"

if [ -z "$PAC_ID" ] || [ -z "$PAC_TOKEN" ]; then
  echo "❌ No se pudo preparar al paciente; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

P=(-H "Authorization: Bearer $PAC_TOKEN" -H "Content-Type: application/json")

# ── Cita original con A1 ────────────────────────────────────────────────────
echo
echo "== Agendar cita con el médico A1 =="

request "${P[@]}" -X POST "$API/citas" \
  -d "{\"medico_id\":$MED_A1,\"consultorio_id\":$CON_ID,\"fecha_hora\":\"${FECHA}T10:00:00${OFFSET}\",\"duracion_minutos\":30,\"motivo\":\"Prueba de reagendamiento\"}"
CITA_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Cita agendada (201)" 201 "$RESP_CODE"
check "Cita creada con A1" "$MED_A1" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.medico_id // empty' 2>/dev/null)"

if [ -z "$CITA_ID" ]; then
  echo "❌ No se pudo agendar la cita; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

# ── Propuestas por médico ───────────────────────────────────────────────────
echo
echo "== Propuestas de horarios =="

request "${A[@]}" "$API/citas/$CITA_ID/propuestas?medico_id=$MED_A2"
check "Propuestas para A2 → ok" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.ok == true and (.data | length > 0)' 2>/dev/null)"
check "Las propuestas son del horario de A2" true \
  "$(printf '%s' "$RESP_BODY" | jq -r --arg c "$CON_ID" '[.data[]? | (.consultorio_id | tostring) == $c] | all' 2>/dev/null)"

request "${A[@]}" "$API/citas/$CITA_ID/propuestas?medico_id=$MED_B"
check "Propuestas para médico de otra especialidad → 400" 400 "$RESP_CODE"
check "El rechazo explica la especialidad" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '((.mensaje // "") | test("especialidad"; "i"))' 2>/dev/null)"

# ── Reagendar cambiando de médico ──────────────────────────────────────────
echo
echo "== Reagendar cambiando de médico =="

request "${P[@]}" -X PUT "$API/citas/$CITA_ID" \
  -d "{\"fecha_hora\":\"${FECHA}T11:00:00${OFFSET}\",\"medico_id\":$MED_A2,\"consultorio_id\":$CON_ID}"
check "Reagendar a A2 → 200" 200 "$RESP_CODE"
check "La cita quedó con A2" "$MED_A2" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.medico_id // empty' 2>/dev/null)"
check "La cita conserva el consultorio" "$CON_ID" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.consultorio_id // empty' 2>/dev/null)"

CITA_ACTUAL="$(body "${A[@]}" "$API/citas/$CITA_ID" 2>/dev/null)"
check "La hora local es 11:00" "11:00" \
  "$(printf '%s' "$CITA_ACTUAL" | jq -r '.data.hora_local // empty' 2>/dev/null)"
check "El detalle muestra al médico A2" true \
  "$(printf '%s' "$CITA_ACTUAL" | jq -r --arg m "$MED_A2" '(.data.medico_id | tostring) == $m' 2>/dev/null)"

# ── Rechazo por especialidad distinta ──────────────────────────────────────
echo
echo "== Rechazos al reagendar =="

request "${P[@]}" -X PUT "$API/citas/$CITA_ID" \
  -d "{\"fecha_hora\":\"${FECHA}T12:00:00${OFFSET}\",\"medico_id\":$MED_B,\"consultorio_id\":$CON_ID}"
check "Cambiar a otra especialidad → 400" 400 "$RESP_CODE"
check "El rechazo cita la misma especialidad" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '((.mensaje // "") | test("misma especialidad"; "i"))' 2>/dev/null)"

CITA_ACTUAL="$(body "${A[@]}" "$API/citas/$CITA_ID" 2>/dev/null)"
check "La cita no cambió tras el rechazo" "$MED_A2" \
  "$(printf '%s' "$CITA_ACTUAL" | jq -r '.data.medico_id // empty' 2>/dev/null)"

request "${P[@]}" -X PUT "$API/citas/$CITA_ID" \
  -d "{\"fecha_hora\":\"${FECHA}T03:00:00${OFFSET}\",\"medico_id\":$MED_A2,\"consultorio_id\":$CON_ID}"
check "Fuera del horario activo → 400" 400 "$RESP_CODE"
check "El rechazo cita RN-072" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '((.mensaje // "") | test("RN-072"))' 2>/dev/null)"

# ── RN-078 al reagendar ─────────────────────────────────────────────────────
echo
echo "== RN-078 al reagendar =="

request "${P[@]}" -X POST "$API/citas" \
  -d "{\"medico_id\":$MED_B,\"consultorio_id\":$CON_ID,\"fecha_hora\":\"${FECHA}T13:00:00${OFFSET}\",\"duracion_minutos\":30,\"motivo\":\"Cita de control\"}"
CITA2_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Cita de control con B agendada" 201 "$RESP_CODE"

request "${P[@]}" -X PUT "$API/citas/$CITA_ID" \
  -d "{\"fecha_hora\":\"${FECHA}T13:00:00${OFFSET}\",\"medico_id\":$MED_A2,\"consultorio_id\":$CON_ID}"
check "Reagendar encima de otra cita del paciente → 409" 409 "$RESP_CODE"
check "El rechazo cita RN-078" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '((.mensaje // "") | test("RN-078"))' 2>/dev/null)"

# ── Reagendar sin medico_id (compatibilidad) ────────────────────────────────
echo
echo "== Compatibilidad sin medico_id =="

request "${P[@]}" -X PUT "$API/citas/$CITA_ID" \
  -d "{\"fecha_hora\":\"${FECHA}T14:00:00${OFFSET}\"}"
check "Reagendar sin medico_id → 200" 200 "$RESP_CODE"
check "El médico se conserva (A2)" "$MED_A2" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.medico_id // empty' 2>/dev/null)"

CITA_ACTUAL="$(body "${A[@]}" "$API/citas/$CITA_ID" 2>/dev/null)"
check "La hora local es 14:00" "14:00" \
  "$(printf '%s' "$CITA_ACTUAL" | jq -r '.data.hora_local // empty' 2>/dev/null)"

echo
echo "Resultado: $ok ✅  $fail ❌"
[ "$fail" -eq 0 ] || exit 1
