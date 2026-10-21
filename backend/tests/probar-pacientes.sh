#!/bin/bash
# Uso: ADMIN='token' PAC='token' [BASE_URL=http://localhost:4000] bash probar-pacientes.sh
BASE_URL="${BASE_URL:-http://localhost:4000}"
BASE_URL="${BASE_URL%/}"
BASE="$BASE_URL/api/pacientes"
USUARIOS="$BASE_URL/api/usuarios"
LOGIN_URL="$BASE_URL/api/auth/login"
S=$RANDOM
ok=0; fail=0

if [ -z "$ADMIN" ] || [ -z "$PAC" ]; then
  echo "❌ Faltan tokens. Uso: ADMIN='token' PAC='token' bash probar-pacientes.sh"
  exit 1
fi

check() { # descripción, esperado, obtenido
  if [ "$2" = "$3" ]; then echo "✅ $1"; ok=$((ok+1))
  else echo "❌ $1 (esperado: $2, obtuvo: $3)"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
body() { curl -s "$@"; }
es_numero() { [[ "$1" =~ ^[0-9]+$ ]]; }

A=(-H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json")
P=(-H "Authorization: Bearer $PAC" -H "Content-Type: application/json")

OWN_USER_ID=""; OTHER_USER_ID=""
OWN_PATIENT_ID=""; OTHER_PATIENT_ID=""

# Limpieza: el DELETE de paciente hace soft delete del paciente y de su usuario.
cleanup() {
  for pid in "$OWN_PATIENT_ID" "$OTHER_PATIENT_ID"; do
    if es_numero "$pid"; then code "${A[@]}" -X DELETE "$BASE/$pid" >/dev/null 2>&1; fi
  done
  for uid in "$OWN_USER_ID" "$OTHER_USER_ID"; do
    if es_numero "$uid"; then code "${A[@]}" -X DELETE "$USUARIOS/$uid" >/dev/null 2>&1; fi
  done
}
trap cleanup EXIT

echo "== Setup: crear dos pacientes de prueba =="
OWN_EMAIL="pac_own_$S@test.com"
OTHER_EMAIL="pac_other_$S@test.com"

R_OWN=$(body "${A[@]}" -X POST "$USUARIOS" -d \
  "{\"nombre\":\"Pac Own $S\",\"email\":\"$OWN_EMAIL\",\"password\":\"password123\",\"rol_id\":3}")
OWN_USER_ID=$(echo "$R_OWN" | jq -r '.data.id // empty')

R_OTHER=$(body "${A[@]}" -X POST "$USUARIOS" -d \
  "{\"nombre\":\"Pac Other $S\",\"email\":\"$OTHER_EMAIL\",\"password\":\"password123\",\"rol_id\":3}")
OTHER_USER_ID=$(echo "$R_OTHER" | jq -r '.data.id // empty')

check "Crear usuario propio → id numérico"  true $(es_numero "$OWN_USER_ID" && echo true || echo false)
check "Crear usuario ajeno → id numérico"   true $(es_numero "$OTHER_USER_ID" && echo true || echo false)

if ! es_numero "$OWN_USER_ID" || ! es_numero "$OTHER_USER_ID"; then
  echo "❌ No se pudieron crear los usuarios de prueba. Aborta."
  exit 1
fi

LISTADO=$(body "${A[@]}" "$BASE")
OWN_PATIENT_ID=$(echo "$LISTADO" | jq -r --arg uid "$OWN_USER_ID" \
  '.data[]? | select((.usuario_id | tostring) == $uid) | .id' | head -1)
OTHER_PATIENT_ID=$(echo "$LISTADO" | jq -r --arg uid "$OTHER_USER_ID" \
  '.data[]? | select((.usuario_id | tostring) == $uid) | .id' | head -1)

check "Registro de paciente propio localizado" true $(es_numero "$OWN_PATIENT_ID" && echo true || echo false)
check "Registro de paciente ajeno localizado"  true $(es_numero "$OTHER_PATIENT_ID" && echo true || echo false)

if ! es_numero "$OWN_PATIENT_ID" || ! es_numero "$OTHER_PATIENT_ID"; then
  echo "❌ No se encontraron los registros de paciente creados. Aborta."
  exit 1
fi

LOGIN_OWN=$(body -X POST "$LOGIN_URL" -H 'Content-Type: application/json' -d \
  "{\"email\":\"$OWN_EMAIL\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}")
OWN_TOKEN=$(echo "$LOGIN_OWN" | jq -r '.data.token // empty')

if [ -z "$OWN_TOKEN" ]; then
  echo "❌ No se pudo obtener el token del paciente propio. Aborta."
  echo "$LOGIN_OWN" | jq . 2>/dev/null || echo "$LOGIN_OWN"
  exit 1
fi

O=(-H "Authorization: Bearer $OWN_TOKEN" -H "Content-Type: application/json")

echo
echo "== Autenticación y permisos =="
check "Sin token → 401"                       401 $(code "$BASE")
check "Paciente no puede listar → 403"        403 $(code "${O[@]}" "$BASE")
check "Paciente no puede crear → 403"         403 $(code "${O[@]}" -X POST "$BASE" -d "{\"usuario_id\":\"$OWN_USER_ID\"}")
check "Paciente no puede editar → 403"        403 $(code "${O[@]}" -X PUT "$BASE/$OWN_PATIENT_ID" -d '{"telefono":"5551234567"}')
check "Paciente no puede eliminar → 403"      403 $(code "${O[@]}" -X DELETE "$BASE/$OWN_PATIENT_ID")
check "PAC externo tampoco puede listar → 403" 403 $(code "${P[@]}" "$BASE")

echo
echo "== RN-053: cada paciente ve solo su registro =="
check "Paciente ve su propio registro → 200"  200 $(code "${O[@]}" "$BASE/$OWN_PATIENT_ID")
check "El registro devuelto es el suyo"       true \
  $(body "${O[@]}" "$BASE/$OWN_PATIENT_ID" | jq -r --arg uid "$OWN_USER_ID" '(.data.usuario_id | tostring) == $uid')
check "Paciente no ve el registro de otro → 403" 403 $(code "${O[@]}" "$BASE/$OTHER_PATIENT_ID")
check "PAC externo no ve un registro ajeno → 403" 403 $(code "${P[@]}" "$BASE/$OWN_PATIENT_ID")
check "Admin sí ve el registro → 200"         200 $(code "${A[@]}" "$BASE/$OWN_PATIENT_ID")

echo
echo "== Validación de IDs =="
check "GET id inválido → 400"                 400 $(code "${A[@]}" "$BASE/abc")
check "GET id fuera de rango bigint → 400"    400 $(code "${A[@]}" "$BASE/99999999999999999999")
check "GET id inexistente → 404"              404 $(code "${A[@]}" "$BASE/3000000000")
check "PUT id inválido → 400"                 400 $(code "${A[@]}" -X PUT "$BASE/abc" -d '{"telefono":"5551234567"}')
check "PUT id inexistente → 404"              404 $(code "${A[@]}" -X PUT "$BASE/3000000000" -d '{"telefono":"5551234567"}')
check "DELETE id inválido → 400"              400 $(code "${A[@]}" -X DELETE "$BASE/abc")
check "DELETE id inexistente → 404"           404 $(code "${A[@]}" -X DELETE "$BASE/3000000000")

echo
echo "== Eliminar: soft delete de paciente y usuario =="
check "Admin elimina paciente → 200"          200 $(code "${A[@]}" -X DELETE "$BASE/$OTHER_PATIENT_ID")
check "Paciente eliminado ya no se ve → 404"  404 $(code "${A[@]}" "$BASE/$OTHER_PATIENT_ID")
check "Login del usuario eliminado → 401"     401 $(code -X POST "$LOGIN_URL" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OTHER_EMAIL\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}")
OTHER_PATIENT_ID=""

echo
echo "== Datos sensibles y errores internos =="
check "Listado sin password_hash"             true \
  $(body "${A[@]}" "$BASE" | jq '(.data | tostring | test("password_hash")) | not')
check "Detalle sin password_hash"             true \
  $(body "${A[@]}" "$BASE/$OWN_PATIENT_ID" | jq '(.data | tostring | test("password_hash")) | not')
check "Error 400 sin campo error interno"     true $(body "${A[@]}" "$BASE/abc" | jq 'has("error") | not')
check "Error 401 sin campo error interno"     true $(body "$BASE" | jq 'has("error") | not')
check "Error 403 sin campo error interno"     true $(body "${O[@]}" "$BASE" | jq 'has("error") | not')
check "Error 404 sin campo error interno"     true $(body "${A[@]}" "$BASE/3000000000" | jq 'has("error") | not')

echo
echo "Resultado: $ok ✅  $fail ❌"
[ "$fail" -eq 0 ]
