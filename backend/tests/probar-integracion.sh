#!/bin/bash
# ============================================================================
# Prueba de integración entre los módulos de administración y de citas.
#
# Flujo:
#   (a) crea especialidad, consultorio y médico propios
#   (b) crea un horario para ese médico
#   (c) como paciente, lista médicos por especialidad y agenda una cita
#   (d) otro paciente intenta la misma hora y recibe un rechazo claro
#   (e) con la cita vigente, no se puede eliminar al médico ni al consultorio
#   (f) con la cita vigente, no se puede eliminar al paciente
#   (g) al cancelar la cita, (e) y (f) ya se permiten
#   (h) el dashboard administrativo refleja la cita en sus totales
#
# Uso:
#   ADMIN='<token>' [BASE_URL=http://localhost:4000] \
#     bash backend/tests/probar-integracion.sh
#
# No usa PAC: crea sus propios pacientes y los elimina al terminar.
# ============================================================================

set -u

BASE_URL="${BASE_URL:-http://localhost:4000}"
BASE_URL="${BASE_URL%/}"
API="$BASE_URL/api"
TZ_BD="${TZ_BD:-America/Mexico_City}"
SECRET="${N8N_WEBHOOK_SECRET:-tu-secreto}"

if [ -z "${ADMIN:-}" ]; then
  echo "❌ Falta el token de administrador."
  echo "   Uso: ADMIN='<token>' [BASE_URL=http://localhost:4000] \\"
  echo "        bash backend/tests/probar-integracion.sh"
  exit 2
fi

ok=0
fail=0
S="$(date +%s)_$RANDOM"

# Fecha futura en la zona horaria de la clínica. Se usa +2 días para evitar
# cruces de medianoche y para que la cita quede dentro del rango de 30 días
# del dashboard.
FECHA="$(TZ="$TZ_BD" date -d '+2 days' +%Y-%m-%d)"
DIA_SEMANA="$(TZ="$TZ_BD" date -d "$FECHA" +%u)"
OFFSET_RAW="$(TZ="$TZ_BD" date -d "$FECHA 10:00" +%z)"
OFFSET="${OFFSET_RAW:0:3}:${OFFSET_RAW:3:2}"
FECHA_HORA="${FECHA}T10:00:00${OFFSET}"

A=(-H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json")

ESP_ID=""
CON_ID=""
MED_ID=""
MED2_ID=""
HOR_ID=""
CITA2_ID=""
PAC1_USER_ID=""
PAC2_USER_ID=""
PAC1_ID=""
PAC2_ID=""
CITA_ID=""
CITA_ESTADO=""

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

get_paciente_id() { # usuario_id
  body "${A[@]}" "$API/pacientes" 2>/dev/null \
    | jq -r --arg uid "$1" '.data[]? | select((.usuario_id | tostring) == $uid) | .id' \
    | head -n 1
}

cleanup() {
  # Si la cita sigue vigente, cancelarla antes de borrar entidades.
  if [ -n "${CITA_ID:-}" ] && [ "${CITA_ESTADO:-}" != "cancelada" ]; then
    code "${A[@]}" -X PUT "$API/citas/$CITA_ID/estado" \
      -d '{"estado":"cancelada","ignorarPlazo":true}' >/dev/null 2>&1 || true
  fi

  if [ -n "${CITA2_ID:-}" ]; then
    code "${A[@]}" -X PUT "$API/citas/$CITA2_ID/estado" \
      -d '{"estado":"cancelada","ignorarPlazo":true}' >/dev/null 2>&1 || true
  fi

  # Pacientes propios (el DELETE de paciente también hace soft delete del usuario).
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

  for mid in "${MED_ID:-}" "${MED2_ID:-}"; do
    if [ -n "$mid" ]; then
      code "${A[@]}" -X DELETE "$API/medicos/$mid" >/dev/null 2>&1 || true
    fi
  done
  if [ -n "${CON_ID:-}" ]; then
    code "${A[@]}" -X DELETE "$API/consultorios/$CON_ID" >/dev/null 2>&1 || true
  fi
  if [ -n "${ESP_ID:-}" ]; then
    code "${A[@]}" -X PATCH "$API/especialidades/$ESP_ID/estado" \
      -d '{"activo":false}' >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "== Datos de la prueba =="
echo "   Fecha local: $FECHA (día $DIA_SEMANA), hora: 10:00 $OFFSET"
echo "   Sufijo:      $S"

# ── (a) Especialidad, consultorio y médico ──────────────────────────────────
echo
echo "== (a) Crear especialidad, consultorio y médico =="

request "${A[@]}" -X POST "$API/especialidades" \
  -d "{\"nombre\":\"Integracion Esp $S\",\"descripcion\":\"Prueba de integración\"}"
ESP_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Especialidad creada" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.ok == true and (.data.id != null)' 2>/dev/null)"
if [ -z "$ESP_ID" ]; then
  echo "❌ No se pudo crear la especialidad; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

request "${A[@]}" -X POST "$API/consultorios" \
  -d "{\"nombre\":\"Integracion Con $S\",\"direccion\":\"Calle de prueba $S\"}"
CON_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Consultorio creado" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.ok == true and (.data.id != null)' 2>/dev/null)"
if [ -z "$CON_ID" ]; then
  echo "❌ No se pudo crear el consultorio; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

request "${A[@]}" -X POST "$API/medicos" \
  -d "{\"nombre\":\"Integracion Med $S\",\"email\":\"integracion_med_$S@test.com\",\"password\":\"password123\",\"cedula_profesional\":\"INT$S\",\"especialidades\":[$ESP_ID],\"consultorios\":[$CON_ID]}"
MED_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Médico creado" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.ok == true and (.data.id != null)' 2>/dev/null)"
if [ -z "$MED_ID" ]; then
  echo "❌ No se pudo crear el médico; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

# ── (b) Horario ─────────────────────────────────────────────────────────────
echo
echo "== (b) Crear horario del médico =="

request "${A[@]}" -X POST "$API/horarios" \
  -d "{\"medico_id\":$MED_ID,\"consultorio_id\":$CON_ID,\"dia_semana\":$DIA_SEMANA,\"hora_inicio\":\"08:00\",\"hora_fin\":\"20:00\"}"
HOR_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Horario creado" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.ok == true and (.data.id != null)' 2>/dev/null)"
if [ -z "$HOR_ID" ]; then
  echo "❌ No se pudo crear el horario; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

# ── Pacientes propios ───────────────────────────────────────────────────────
echo
echo "== Crear dos pacientes propios =="

request "${A[@]}" -X POST "$API/usuarios" \
  -d "{\"nombre\":\"Integracion Paciente 1 $S\",\"email\":\"integracion_p1_$S@test.com\",\"password\":\"password123\",\"rol_id\":3}"
PAC1_USER_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Paciente 1 creado" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.ok == true and (.data.id != null)' 2>/dev/null)"

request "${A[@]}" -X POST "$API/usuarios" \
  -d "{\"nombre\":\"Integracion Paciente 2 $S\",\"email\":\"integracion_p2_$S@test.com\",\"password\":\"password123\",\"rol_id\":3}"
PAC2_USER_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Paciente 2 creado" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.ok == true and (.data.id != null)' 2>/dev/null)"

PAC1_ID="$(get_paciente_id "$PAC1_USER_ID")"
PAC2_ID="$(get_paciente_id "$PAC2_USER_ID")"
check "Paciente 1 tiene registro de paciente" true "$([ -n "$PAC1_ID" ] && echo true || echo false)"
check "Paciente 2 tiene registro de paciente" true "$([ -n "$PAC2_ID" ] && echo true || echo false)"
if [ -z "$PAC1_ID" ] || [ -z "$PAC2_ID" ]; then
  echo "❌ No se pudieron obtener los pacientes; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

request -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"integracion_p1_$S@test.com\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}"
PAC1_TOKEN="$(printf '%s' "$RESP_BODY" | jq -r '.data.token // empty' 2>/dev/null)"
check "Login paciente 1" true "$([ -n "$PAC1_TOKEN" ] && echo true || echo false)"

request -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"integracion_p2_$S@test.com\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}"
PAC2_TOKEN="$(printf '%s' "$RESP_BODY" | jq -r '.data.token // empty' 2>/dev/null)"
check "Login paciente 2" true "$([ -n "$PAC2_TOKEN" ] && echo true || echo false)"

if [ -z "$PAC1_TOKEN" ] || [ -z "$PAC2_TOKEN" ]; then
  echo "❌ No se pudieron iniciar sesión los pacientes; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

P1=(-H "Authorization: Bearer $PAC1_TOKEN" -H "Content-Type: application/json")
P2=(-H "Authorization: Bearer $PAC2_TOKEN" -H "Content-Type: application/json")

# ── (c) Listar médicos por especialidad y agendar ──────────────────────────
echo
echo "== (c) Paciente lista médicos por especialidad y agenda =="

LISTA="$(body "${P1[@]}" "$API/medicos?especialidad=$ESP_ID" 2>/dev/null)"
check "La lista incluye al médico" true \
  "$(printf '%s' "$LISTA" | jq -r --arg id "$MED_ID" '([.data[]? | (.id | tostring)] | index($id)) != null' 2>/dev/null)"
check "El paciente no ve email del médico" true \
  "$(printf '%s' "$LISTA" | jq -r '[.data[]? | (.email // "") == ""] | all' 2>/dev/null)"
check "El paciente no ve cédula del médico" true \
  "$(printf '%s' "$LISTA" | jq -r '[.data[]? | (.cedula_profesional // "") == ""] | all' 2>/dev/null)"

# El dashboard usa por defecto los últimos 30 días; para ver una cita futura
# se consulta el rango exacto de la fecha de la cita.
DASH_URL="$API/dashboard/admin?fecha_inicio=$FECHA&fecha_fin=$FECHA"
BASE_DASH="$(body "${A[@]}" "$DASH_URL" 2>/dev/null)"
BASE_RANGO="$(printf '%s' "$BASE_DASH" | jq -r '.data.totales.citasRango // 0' 2>/dev/null)"

CITA_BODY="{\"medico_id\":$MED_ID,\"consultorio_id\":$CON_ID,\"fecha_hora\":\"$FECHA_HORA\",\"duracion_minutos\":30,\"motivo\":\"Prueba de integración\"}"
request "${P1[@]}" -X POST "$API/citas" -d "$CITA_BODY"
CITA_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Cita agendada (201)" 201 "$RESP_CODE"
check "La cita nace pendiente" "pendiente" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.estado // empty' 2>/dev/null)"
check "La hora local se conserva" "10:00" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.hora_local // empty' 2>/dev/null)"
if [ -z "$CITA_ID" ]; then
  echo "❌ No se pudo agendar la cita; se aborta la prueba."
  echo "Resultado: $ok ✅  $fail ❌"
  exit 1
fi

# ── (c2) Cita desde Telegram: n8n envía x-webhook-secret y origen ──────────
echo
echo "== (c2) Cita creada desde Telegram/n8n =="

TG_FECHA_HORA="${FECHA}T11:00:00${OFFSET}"
TG_BODY="{\"medico_id\":$MED_ID,\"consultorio_id\":$CON_ID,\"fecha_hora\":\"$TG_FECHA_HORA\",\"duracion_minutos\":30,\"motivo\":\"Prueba Telegram\",\"origen\":\"telegram\"}"
request "${P2[@]}" -H "x-webhook-secret: $SECRET" -X POST "$API/citas" -d "$TG_BODY"
TG_CITA_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Cita de Telegram agendada (201)" 201 "$RESP_CODE"
check "La cita de Telegram nace confirmada" "confirmada" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.estado // empty' 2>/dev/null)"

# Seguridad: un paciente web no puede saltarse la regla de los 30 minutos
# enviando origen=telegram sin el secreto compartido de n8n.
SPOOF_FECHA_HORA="${FECHA}T12:00:00${OFFSET}"
SPOOF_BODY="{\"medico_id\":$MED_ID,\"consultorio_id\":$CON_ID,\"fecha_hora\":\"$SPOOF_FECHA_HORA\",\"duracion_minutos\":30,\"motivo\":\"Prueba spoof\",\"origen\":\"telegram\"}"
request "${P2[@]}" -X POST "$API/citas" -d "$SPOOF_BODY"
SPOOF_CITA_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "origen=telegram sin secreto sigue pendiente" "pendiente" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.estado // empty' 2>/dev/null)"

# El secreto por sí solo también identifica a n8n aunque no envíe `origen`.
SOLO_SECRETO_FECHA_HORA="${FECHA}T13:00:00${OFFSET}"
SOLO_SECRETO_BODY="{\"medico_id\":$MED_ID,\"consultorio_id\":$CON_ID,\"fecha_hora\":\"$SOLO_SECRETO_FECHA_HORA\",\"duracion_minutos\":30,\"motivo\":\"Prueba solo secreto\"}"
request "${P2[@]}" -H "x-webhook-secret: $SECRET" -X POST "$API/citas" -d "$SOLO_SECRETO_BODY"
SOLO_SECRETO_CITA_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "x-webhook-secret sin origen también confirma" "confirmada" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.estado // empty' 2>/dev/null)"

for cita_aux in "$TG_CITA_ID" "$SPOOF_CITA_ID" "$SOLO_SECRETO_CITA_ID"; do
  if [ -n "$cita_aux" ]; then
    request "${A[@]}" -X PUT "$API/citas/$cita_aux/estado" \
      -d '{"estado":"cancelada","ignorarPlazo":true}'
    check "Cita auxiliar $cita_aux cancelada" 200 "$RESP_CODE"
  fi
done

# ── (d) Misma hora con otro paciente ────────────────────────────────────────
echo
echo "== (d) Otro paciente intenta la misma hora =="

request "${P2[@]}" -X POST "$API/citas" -d "$CITA_BODY"
check "Segundo paciente recibe 409" 409 "$RESP_CODE"
check "El rechazo explica el traslape (RN-074/RN-075)" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '((.mensaje // "") | test("ocupad|traslap"; "i"))' 2>/dev/null)"

# ── (d2) Reglas críticas sobre la cita vigente ─────────────────────────────
echo
echo "== (d2) RN-072 / RN-082 / RN-083 / RN-078 =="

# RN-072: fuera del horario activo del médico (08:00-20:00 local).
FUERA_HORA="${FECHA}T05:00:00${OFFSET}"
request "${P1[@]}" -X POST "$API/citas" \
  -d "{\"medico_id\":$MED_ID,\"consultorio_id\":$CON_ID,\"fecha_hora\":\"$FUERA_HORA\",\"duracion_minutos\":30}"
check "Agendar fuera del horario → 400" 400 "$RESP_CODE"
check "El rechazo cita RN-072" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '((.mensaje // "") | test("fuera de un horario activo"; "i"))' 2>/dev/null)"

# RN-082: un médico no puede marcar asistencia antes del inicio. El admin
# sí puede (se usa el token del médico asignado para probar la restricción).
request -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"integracion_med_$S@test.com\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}"
MED_TOKEN="$(printf '%s' "$RESP_BODY" | jq -r '.data.token // empty' 2>/dev/null)"
check "Login médico" true "$([ -n "$MED_TOKEN" ] && echo true || echo false)"
M=(-H "Authorization: Bearer $MED_TOKEN" -H "Content-Type: application/json")

request "${M[@]}" -X PUT "$API/citas/$CITA_ID/estado" -d '{"estado":"completada"}'
check "Completar antes del inicio → 400" 400 "$RESP_CODE"
check "El rechazo cita RN-082" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '((.mensaje // "") | test("aún no ha comenzado"; "i"))' 2>/dev/null)"
request "${M[@]}" -X PUT "$API/citas/$CITA_ID/estado" -d '{"estado":"no_asistio"}'
check "Marcar no_asistio antes del inicio → 400" 400 "$RESP_CODE"
check "La cita sigue pendiente tras el rechazo" "pendiente" \
  "$(body "${A[@]}" "$API/citas/$CITA_ID" 2>/dev/null | jq -r '.data.estado // empty' 2>/dev/null)"

# RN-083: las propuestas devuelven día ISO (1-7) y fecha con offset local.
PROP="$(body "${A[@]}" "$API/citas/$CITA_ID/propuestas" 2>/dev/null)"
check "Propuestas de reagendamiento → ok" true \
  "$(printf '%s' "$PROP" | jq -r '.ok == true and (.data | length > 0)' 2>/dev/null)"
check "dia_semana ISO entre 1 y 7" true \
  "$(printf '%s' "$PROP" | jq -r '[.data[]? | (.dia_semana | type == "number" and . >= 1 and . <= 7)] | all' 2>/dev/null)"
check "fecha_hora de propuesta lleva offset local (no Z)" true \
  "$(printf '%s' "$PROP" | jq -r '[.data[]? | (.fecha_hora | test("-[0-9]{2}:[0-9]{2}$"))] | all' 2>/dev/null)"

# RN-078: el mismo paciente no puede ocupar dos médicos a la misma hora.
request "${A[@]}" -X POST "$API/medicos" \
  -d "{\"nombre\":\"Integracion Med2 $S\",\"email\":\"integracion_med2_$S@test.com\",\"password\":\"password123\",\"cedula_profesional\":\"INT2$S\",\"especialidades\":[$ESP_ID],\"consultorios\":[$CON_ID]}"
MED2_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
check "Médico 2 creado" true \
  "$(printf '%s' "$RESP_BODY" | jq -r '.ok == true and (.data.id != null)' 2>/dev/null)"
if [ -n "$MED2_ID" ]; then
  request "${A[@]}" -X POST "$API/horarios" \
    -d "{\"medico_id\":$MED2_ID,\"consultorio_id\":$CON_ID,\"dia_semana\":$DIA_SEMANA,\"hora_inicio\":\"08:00\",\"hora_fin\":\"20:00\"}"
  check "Horario del médico 2 creado" true \
    "$(printf '%s' "$RESP_BODY" | jq -r '.ok == true and (.data.id != null)' 2>/dev/null)"

  # El hueco está libre para el médico 2, pero el paciente 1 ya está ocupado.
  request "${P1[@]}" -X POST "$API/citas" \
    -d "{\"medico_id\":$MED2_ID,\"consultorio_id\":$CON_ID,\"fecha_hora\":\"$FECHA_HORA\",\"duracion_minutos\":30}"
  check "Paciente con dos médicos a la misma hora → 409" 409 "$RESP_CODE"
  check "El rechazo cita RN-078" true \
    "$(printf '%s' "$RESP_BODY" | jq -r '((.mensaje // "") | test("traslapa"; "i"))' 2>/dev/null)"

  # Prueba control: otro paciente sí puede tomar ese mismo hueco.
  request "${P2[@]}" -X POST "$API/citas" \
    -d "{\"medico_id\":$MED2_ID,\"consultorio_id\":$CON_ID,\"fecha_hora\":\"$FECHA_HORA\",\"duracion_minutos\":30}"
  CITA2_ID="$(printf '%s' "$RESP_BODY" | jq -r '.data.id // empty' 2>/dev/null)"
  check "Otro paciente toma el hueco (control) → 201" 201 "$RESP_CODE"
  if [ -n "$CITA2_ID" ]; then
    request "${A[@]}" -X PUT "$API/citas/$CITA2_ID/estado" \
      -d '{"estado":"cancelada","ignorarPlazo":true}'
    check "Cita de control cancelada" 200 "$RESP_CODE"
    CITA2_ID=""
  fi
  check "Eliminar médico 2 sin citas vigentes → 200" 200 \
    "$(code "${A[@]}" -X DELETE "$API/medicos/$MED2_ID")"
  MED2_ID=""
fi

# ── (e) Eliminar médico/consultorio con cita vigente ───────────────────────
echo
echo "== (e) Eliminar médico/consultorio con cita vigente =="

check "Eliminar médico con cita vigente → 409" 409 \
  "$(code "${A[@]}" -X DELETE "$API/medicos/$MED_ID")"
check "Eliminar consultorio con cita vigente → 409" 409 \
  "$(code "${A[@]}" -X DELETE "$API/consultorios/$CON_ID")"

# ── (f) Eliminar paciente con cita vigente ─────────────────────────────────
echo
echo "== (f) Eliminar paciente con cita vigente =="

check "Eliminar paciente con cita vigente → 409" 409 \
  "$(code "${A[@]}" -X DELETE "$API/pacientes/$PAC1_ID")"

# ── (h) Dashboard refleja la cita ───────────────────────────────────────────
echo
echo "== (h) Dashboard administrativo refleja la cita =="

DASH="$(body "${A[@]}" "$DASH_URL" 2>/dev/null)"
check "Dashboard responde ok" true \
  "$(printf '%s' "$DASH" | jq -r '.ok == true' 2>/dev/null)"
check "citasRango aumentó al menos 1" true \
  "$(printf '%s' "$DASH" | jq -r --argjson base "$BASE_RANGO" '(.data.totales.citasRango // 0) >= ($base + 1)' 2>/dev/null)"
check "citasPorDia incluye la fecha de la cita" true \
  "$(printf '%s' "$DASH" | jq -r --arg f "$FECHA" '([.data.citasPorDia[]? | select(.fecha == $f) | .total] | add // 0) >= 1' 2>/dev/null)"
check "citasPorEstado incluye una pendiente" true \
  "$(printf '%s' "$DASH" | jq -r '([.data.citasPorEstado[]? | select(.estado == "pendiente") | .total] | add // 0) >= 1' 2>/dev/null)"

# ── (g) Cancelar y repetir (e)/(f) ──────────────────────────────────────────
echo
echo "== (g) Cancelar la cita y repetir las eliminaciones =="

request "${A[@]}" -X PUT "$API/citas/$CITA_ID/estado" \
  -d '{"estado":"cancelada","ignorarPlazo":true}'
check "Cancelar cita → 200" 200 "$RESP_CODE"
check "La cita queda cancelada" "cancelada" \
  "$(printf '%s' "$RESP_BODY" | jq -r '.data.estado // empty' 2>/dev/null)"
CITA_ESTADO="cancelada"

# RN-091: el historial guarda quién lo cambió y desde qué origen.
HIST="$(body "${A[@]}" "$API/citas/$CITA_ID/historial" 2>/dev/null)"
check "Historial registra el cambio" true \
  "$(printf '%s' "$HIST" | jq -r '(.data | length) >= 1' 2>/dev/null)"
check "origen = web" "web" \
  "$(printf '%s' "$HIST" | jq -r '.data[-1].origen // empty' 2>/dev/null)"
check "cambiado_por registrado (no nulo)" true \
  "$(printf '%s' "$HIST" | jq -r '(.data[-1].cambiado_por != null)' 2>/dev/null)"

CODIGO_MED="$(code "${A[@]}" -X DELETE "$API/medicos/$MED_ID")"
check "Eliminar médico tras cancelar → 200" 200 "$CODIGO_MED"
[ "$CODIGO_MED" = "200" ] && MED_ID=""

CODIGO_CON="$(code "${A[@]}" -X DELETE "$API/consultorios/$CON_ID")"
check "Eliminar consultorio tras cancelar → 200" 200 "$CODIGO_CON"
[ "$CODIGO_CON" = "200" ] && CON_ID=""

CODIGO_PAC="$(code "${A[@]}" -X DELETE "$API/pacientes/$PAC1_ID")"
check "Eliminar paciente tras cancelar → 200" 200 "$CODIGO_PAC"
if [ "$CODIGO_PAC" = "200" ]; then
  PAC1_ID=""
  PAC1_USER_ID=""
fi

echo
echo "Resultado: $ok ✅  $fail ❌"
if [ "$fail" -gt 0 ]; then
  exit 1
fi
exit 0
