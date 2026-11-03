#!/bin/bash
# ============================================================================
# Ejecuta todas las pruebas backend/tests/probar-*.sh en orden.
#
# Uso:
#   ADMIN='<token>' PAC='<token>' [BASE_URL=http://localhost:4000] \
#     bash backend/tests/correr-todo.sh
#
# Requiere jq y curl. Termina con código distinto de cero si algún script falla.
# ============================================================================

set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:4000}"
BASE_URL="${BASE_URL%/}"

if [ -z "${ADMIN:-}" ] || [ -z "${PAC:-}" ]; then
  echo "❌ Faltan tokens de prueba."
  echo "   Uso: ADMIN='<token>' PAC='<token>' [BASE_URL=http://localhost:4000] \\"
  echo "        bash backend/tests/correr-todo.sh"
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "❌ curl no está instalado."
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq no está instalado."
  exit 2
fi

if ! curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1; then
  echo "❌ El backend no responde en $BASE_URL/api/health"
  echo "   Inicia el backend y vuelve a intentarlo."
  exit 2
fi

shopt -s nullglob
scripts=( "$DIR"/probar-*.sh )
if [ ${#scripts[@]} -eq 0 ]; then
  echo "❌ No se encontraron scripts $DIR/probar-*.sh"
  exit 2
fi

total_ok=0
total_fail=0
fallidos=()
resumen=()

for script in "${scripts[@]}"; do
  nombre="$(basename "$script")"
  echo
  echo "============================================================================"
  echo "▶ $nombre"
  echo "============================================================================"

  salida="$(BASE_URL="$BASE_URL" ADMIN="$ADMIN" PAC="$PAC" \
    N8N_WEBHOOK_SECRET="${N8N_WEBHOOK_SECRET:-}" bash "$script" 2>&1)"
  estado=$?
  printf '%s\n' "$salida"

  linea="$(printf '%s\n' "$salida" | grep -E '^Resultado: [0-9]+ ✅  [0-9]+ ❌' | tail -n 1)"
  if [ -n "$linea" ]; then
    ok="$(printf '%s\n' "$linea" | sed -E 's/^Resultado: ([0-9]+) ✅  ([0-9]+) ❌/\1/')"
    fail="$(printf '%s\n' "$linea" | sed -E 's/^Resultado: ([0-9]+) ✅  ([0-9]+) ❌/\2/')"
    total_ok=$((total_ok + ok))
    total_fail=$((total_fail + fail))
    resumen+=("$nombre: $ok ✅  $fail ❌  (exit $estado)")
  else
    # Un script que muere antes de imprimir su resultado cuenta como fallo.
    fail=1
    total_fail=$((total_fail + fail))
    resumen+=("$nombre: sin resultado  (exit $estado)")
  fi

  if [ "$estado" -ne 0 ] || [ "$fail" -ne 0 ]; then
    fallidos+=("$nombre")
  fi
done

echo
echo "============================================================================"
echo "RESUMEN POR SCRIPT"
echo "============================================================================"
for fila in "${resumen[@]}"; do
  echo "  $fila"
done

echo
echo "TOTAL: $total_ok ✅  $total_fail ❌"
if [ ${#fallidos[@]} -gt 0 ]; then
  echo "Scripts con fallos: ${fallidos[*]}"
  exit 1
fi

echo "Todos los scripts terminaron correctamente."
exit 0
