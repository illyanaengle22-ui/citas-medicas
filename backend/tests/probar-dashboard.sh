#!/bin/bash
# ============================================================================
# Prueba del Dashboard administrativo
# Uso: ADMIN='<token>' PAC='<token>' [BASE_URL=http://localhost:4000] \
#        bash probar-dashboard.sh
#
# Es una prueba de solo lectura: no crea, modifica ni elimina datos.
# Verifica el rango por defecto (30 días), los filtros personalizados de
# fecha y la agrupación diaria/mensual de los registros.
# ============================================================================

BASE_URL="${BASE_URL:-http://localhost:4000}"
BASE_URL="${BASE_URL%/}"
BASE="$BASE_URL/api/dashboard/admin"
STATS_VIEJO="$BASE_URL/api/dashboard/stats"
TZ_BD="${TZ_BD:-America/Mexico_City}"
HOY=$(TZ="$TZ_BD" date +%Y-%m-%d)
HACE_6=$(TZ="$TZ_BD" date -d "-6 days" +%Y-%m-%d)
HACE_29=$(TZ="$TZ_BD" date -d "-29 days" +%Y-%m-%d)
HACE_44=$(TZ="$TZ_BD" date -d "-44 days" +%Y-%m-%d)
HACE_89=$(TZ="$TZ_BD" date -d "-89 days" +%Y-%m-%d)

ok=0; fail=0

if [ -z "$ADMIN" ] || [ -z "$PAC" ]; then
  echo "❌ Faltan tokens. Uso: ADMIN='token' PAC='token' bash probar-dashboard.sh"
  exit 1
fi

check() { # descripción, esperado, obtenido
  if [ "$2" = "$3" ]; then echo "✅ $1"; ok=$((ok+1))
  else echo "❌ $1 (esperado: $2, obtuvo: $3)"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
body() { curl -s "$@"; }
es_entero_positivo_o_cero() { [[ "$1" =~ ^[0-9]+$ ]]; }

A=(-H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json")
P=(-H "Authorization: Bearer $PAC" -H "Content-Type: application/json")

echo "== Autenticación y autorización =="
check "Sin token → 401"                    401 $(code "$BASE")
check "Paciente no puede consultar → 403"  403 $(code "${P[@]}" "$BASE")
check "Admin puede consultar → 200"        200 $(code "${A[@]}" "$BASE")
check "Token inválido → 401"               401 $(code -H "Authorization: Bearer token-invalido" "$BASE")

RESP=$(body "${A[@]}" "$BASE")
CITAS_TOTAL=$(echo "$RESP" | jq -r '[.data.citasPorEstado[]?.total // 0] | add // 0' 2>/dev/null)
CITAS_TOTAL="${CITAS_TOTAL:-0}"

echo
echo "== Contrato de respuesta =="
check "Respuesta ok=true"                    true  $(echo "$RESP" | jq -r '.ok == true' 2>/dev/null)
check "Respuesta incluye mensaje"            true  $(echo "$RESP" | jq -r '(.mensaje | type) == "string" and (.mensaje | length > 0)' 2>/dev/null)
check "Respuesta incluye data"               true  $(echo "$RESP" | jq -r '(.data | type) == "object"' 2>/dev/null)
check "Respuesta sin password_hash"           true  $(echo "$RESP" | jq -r '(.data | tostring | test("password_hash")) | not' 2>/dev/null)
check "Respuesta sin error interno"           true  $(echo "$RESP" | jq -r 'has("error") | not' 2>/dev/null)

echo
echo "== Totales =="
check "totales contiene las 9 claves" true \
  $(echo "$RESP" | jq -r '.data.totales | (keys | sort) == (["usuarios","pendientes","medicosActivos","pacientes","consultoriosActivos","especialidadesActivas","citasHoy","citasMes","citasRango"] | sort)' 2>/dev/null)
check "Todos los totales son enteros ≥ 0" true \
  $(echo "$RESP" | jq -r '[.data.totales[] | (type == "number") and (. >= 0) and (. == floor)] | all' 2>/dev/null)
check "usuarios es numérico"                 true  $(echo "$RESP" | jq -r '.data.totales.usuarios | type == "number"' 2>/dev/null)
check "pendientes es numérico"               true  $(echo "$RESP" | jq -r '.data.totales.pendientes | type == "number"' 2>/dev/null)
check "medicosActivos es numérico"           true  $(echo "$RESP" | jq -r '.data.totales.medicosActivos | type == "number"' 2>/dev/null)
check "pacientes es numérico"                true  $(echo "$RESP" | jq -r '.data.totales.pacientes | type == "number"' 2>/dev/null)
check "consultoriosActivos es numérico"      true  $(echo "$RESP" | jq -r '.data.totales.consultoriosActivos | type == "number"' 2>/dev/null)
check "especialidadesActivas es numérico"    true  $(echo "$RESP" | jq -r '.data.totales.especialidadesActivas | type == "number"' 2>/dev/null)
check "citasHoy es numérico"                 true  $(echo "$RESP" | jq -r '.data.totales.citasHoy | type == "number"' 2>/dev/null)
check "citasMes es numérico"                 true  $(echo "$RESP" | jq -r '.data.totales.citasMes | type == "number"' 2>/dev/null)
check "citasRango es numérico"               true  $(echo "$RESP" | jq -r '.data.totales.citasRango | type == "number"' 2>/dev/null)

echo
echo "== Usuarios por rol y estado =="
check "usuariosPorRol es array"              true  $(echo "$RESP" | jq -r '.data.usuariosPorRol | type == "array"' 2>/dev/null)
check "usuariosPorRol con rol y total"       true  $(echo "$RESP" | jq -r '.data.usuariosPorRol | all((.rol | type) == "string" and (.total | type) == "number" and .total >= 0)' 2>/dev/null)
check "usuariosPorEstado es array"            true  $(echo "$RESP" | jq -r '.data.usuariosPorEstado | type == "array"' 2>/dev/null)
check "usuariosPorEstado con estado y total" true  $(echo "$RESP" | jq -r '.data.usuariosPorEstado | all((.estado | type) == "string" and (.total | type) == "number" and .total >= 0)' 2>/dev/null)

echo
echo "== Rango de fechas =="
check "rango.fechaInicio por defecto"        "$HACE_29" $(echo "$RESP" | jq -r '.data.rango.fechaInicio' 2>/dev/null)
check "rango.fechaFin por defecto"           "$HOY"     $(echo "$RESP" | jq -r '.data.rango.fechaFin' 2>/dev/null)
check "rango.dias por defecto = 30"          30         $(echo "$RESP" | jq -r '.data.rango.dias' 2>/dev/null)
check "rango.agrupacionRegistros = dia"      dia        $(echo "$RESP" | jq -r '.data.rango.agrupacionRegistros' 2>/dev/null)

echo
echo "== Registros por día =="
check "registrosPorMes tiene 30 días"        30    $(echo "$RESP" | jq -r '.data.registrosPorMes | length' 2>/dev/null)
check "Cada día tiene fecha, etiqueta y total" true \
  $(echo "$RESP" | jq -r '.data.registrosPorMes | all((.fecha | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")) and ((.etiqueta | type) == "string") and ((.total | type) == "number") and .total >= 0)' 2>/dev/null)
DIAS_REG=$(echo "$RESP" | jq -r '.data.registrosPorMes[].fecha' 2>/dev/null)
DIAS_OK=true; DIA_PREV=""
for dia in $DIAS_REG; do
  if [ -n "$DIA_PREV" ]; then
    DIA_ESPERADO=$(TZ="$TZ_BD" date -d "$DIA_PREV +1 day" +%Y-%m-%d 2>/dev/null)
    [ "$dia" = "$DIA_ESPERADO" ] || DIAS_OK=false
  fi
  DIA_PREV="$dia"
done
check "Los 30 días son consecutivos"         true  "$DIAS_OK"
check "El primer día es hace 29 días"        "$HACE_29" "$(echo "$DIAS_REG" | head -n 1)"
check "El último día es hoy"                 "$HOY"     "$DIA_PREV"

echo
echo "== Filtro personalizado: últimos 7 días =="
R7=$(body "${A[@]}" "$BASE?fecha_inicio=$HACE_6&fecha_fin=$HOY")
check "Rango de 7 días → 200"                200 $(code "${A[@]}" "$BASE?fecha_inicio=$HACE_6&fecha_fin=$HOY")
check "rango.dias = 7"                       7   $(echo "$R7" | jq -r '.data.rango.dias' 2>/dev/null)
check "rango.fechaInicio = hace 6 días"      "$HACE_6" $(echo "$R7" | jq -r '.data.rango.fechaInicio' 2>/dev/null)
check "Agrupación diaria con 7 días"         dia $(echo "$R7" | jq -r '.data.rango.agrupacionRegistros' 2>/dev/null)
check "registrosPorMes tiene 7 días"         7   $(echo "$R7" | jq -r '.data.registrosPorMes | length' 2>/dev/null)
check "citasPorDia tiene 7 días"             7   $(echo "$R7" | jq -r '.data.citasPorDia | length' 2>/dev/null)

echo
echo "== Filtro personalizado: últimos 45 días =="
R45=$(body "${A[@]}" "$BASE?fecha_inicio=$HACE_44&fecha_fin=$HOY")
check "Rango de 45 días → 200"               200 $(code "${A[@]}" "$BASE?fecha_inicio=$HACE_44&fecha_fin=$HOY")
check "rango.dias = 45"                      45  $(echo "$R45" | jq -r '.data.rango.dias' 2>/dev/null)
check "Agrupación diaria hasta 60 días"      dia $(echo "$R45" | jq -r '.data.rango.agrupacionRegistros' 2>/dev/null)
check "Registros de 45 días con campo fecha" true \
  $(echo "$R45" | jq -r '.data.registrosPorMes | length == 45 and all((.fecha | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")))' 2>/dev/null)

echo
echo "== Filtro personalizado: últimos 90 días =="
R90=$(body "${A[@]}" "$BASE?fecha_inicio=$HACE_89&fecha_fin=$HOY")
check "Rango de 90 días → 200"               200 $(code "${A[@]}" "$BASE?fecha_inicio=$HACE_89&fecha_fin=$HOY")
check "rango.dias = 90"                      90  $(echo "$R90" | jq -r '.data.rango.dias' 2>/dev/null)
check "Agrupación mensual con 90 días"       mes $(echo "$R90" | jq -r '.data.rango.agrupacionRegistros' 2>/dev/null)
check "Registros por mes con campo mes"      true \
  $(echo "$R90" | jq -r '.data.registrosPorMes | length > 0 and all((.mes | test("^[0-9]{4}-[0-9]{2}$")) and ((.etiqueta | type) == "string") and ((.total | type) == "number"))' 2>/dev/null)

echo
echo "== Validación del rango =="
check "Fecha inválida → 400"                 400 $(code "${A[@]}" "$BASE?fecha_inicio=2026-13-01&fecha_fin=$HOY")
check "fecha_inicio posterior → 400"         400 $(code "${A[@]}" "$BASE?fecha_inicio=$HOY&fecha_fin=$HACE_6")
check "Rango mayor a 366 días → 400"         400 $(code "${A[@]}" "$BASE?fecha_inicio=2020-01-01&fecha_fin=$HOY")

echo
echo "== Médicos por especialidad y consultorio =="
check "medicosPorEspecialidad es array"      true  $(echo "$RESP" | jq -r '.data.medicosPorEspecialidad | type == "array"' 2>/dev/null)
check "Máximo 8 especialidades"              true  $(echo "$RESP" | jq -r '(.data.medicosPorEspecialidad | length) <= 8' 2>/dev/null)
check "Especialidades con nombre y total"    true  $(echo "$RESP" | jq -r '.data.medicosPorEspecialidad | all((.especialidad | type) == "string" and (.total | type) == "number" and .total >= 0)' 2>/dev/null)
check "medicosPorConsultorio es array"       true  $(echo "$RESP" | jq -r '.data.medicosPorConsultorio | type == "array"' 2>/dev/null)
check "Consultorios con nombre y total"      true  $(echo "$RESP" | jq -r '.data.medicosPorConsultorio | all((.consultorio | type) == "string" and (.total | type) == "number" and .total >= 0)' 2>/dev/null)

echo
echo "== Citas por estado =="
check "citasPorEstado es array"              true  $(echo "$RESP" | jq -r '.data.citasPorEstado | type == "array"' 2>/dev/null)
check "Citas con estado y total"             true  $(echo "$RESP" | jq -r '.data.citasPorEstado | all((.estado | type) == "string" and (.total | type) == "number" and .total >= 0)' 2>/dev/null)
check "Incluye los estados del catálogo"     true \
  $(echo "$RESP" | jq -r '(["pendiente","confirmada","reagendada","cancelada","completada","no_asistio"] - [.data.citasPorEstado[].estado]) | length == 0' 2>/dev/null)

echo
echo "== Citas por día =="
check "citasPorDia tiene 30 días"            30    $(echo "$RESP" | jq -r '.data.citasPorDia | length' 2>/dev/null)
check "Cada día tiene fecha, etiqueta y total" true \
  $(echo "$RESP" | jq -r '.data.citasPorDia | all((.fecha | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")) and ((.etiqueta | type) == "string") and ((.total | type) == "number") and .total >= 0)' 2>/dev/null)
FECHAS=$(echo "$RESP" | jq -r '.data.citasPorDia[].fecha' 2>/dev/null)
FECHAS_OK=true; FECHA_PREV=""
for fecha in $FECHAS; do
  if [ -n "$FECHA_PREV" ]; then
    FECHA_ESPERADA=$(TZ="$TZ_BD" date -d "$FECHA_PREV +1 day" +%Y-%m-%d 2>/dev/null)
    [ "$fecha" = "$FECHA_ESPERADA" ] || FECHAS_OK=false
  fi
  FECHA_PREV="$fecha"
done
check "Los 30 días son consecutivos"         true  "$FECHAS_OK"
check "El primer día es hace 29 días"        "$HACE_29" "$(echo "$FECHAS" | head -n 1)"
check "El último día es hoy"                  "$HOY"      "$FECHA_PREV"

echo
echo "== Porcentajes y duración =="
check "porcentajes incluye las 2 claves"     true \
  $(echo "$RESP" | jq -r '.data.porcentajes | (keys | sort) == (["cuentasPendientes","citasConfirmadas"] | sort)' 2>/dev/null)
check "Porcentajes numéricos entre 0 y 100"  true \
  $(echo "$RESP" | jq -r '[.data.porcentajes[] | (type == "number") and (. >= 0) and (. <= 100)] | all' 2>/dev/null)
check "Porcentajes con máximo 1 decimal"      true \
  $(echo "$RESP" | jq -r '[.data.porcentajes[] | tostring | test("^[0-9]+(\\.[0-9])?$")] | all' 2>/dev/null)
check "cuentasPendientes es numérico"        true  $(echo "$RESP" | jq -r '.data.porcentajes.cuentasPendientes | type == "number"' 2>/dev/null)
check "citasConfirmadas es numérico"         true  $(echo "$RESP" | jq -r '.data.porcentajes.citasConfirmadas | type == "number"' 2>/dev/null)
check "duracionPromedioCitas es numérico"    true  $(echo "$RESP" | jq -r '(.data.duracionPromedioCitas | type == "number") and .data.duracionPromedioCitas >= 0' 2>/dev/null)
check "duracionPromedioTexto tiene formato"  true \
  $(echo "$RESP" | jq -r '.data.duracionPromedioTexto | test("^[0-9]+ h ([0-9]|[1-5][0-9]) min$")' 2>/dev/null)

DURACION_MIN=$(echo "$RESP" | jq -r '.data.duracionPromedioCitas // 0' 2>/dev/null)
DURACION_MIN="${DURACION_MIN:-0}"
DURACION_TEXTO=$(echo "$RESP" | jq -r '.data.duracionPromedioTexto // ""' 2>/dev/null)
if es_entero_positivo_o_cero "$DURACION_MIN"; then
  DURACION_ESPERADA="$((DURACION_MIN / 60)) h $((DURACION_MIN % 60)) min"
  check "duración coherente con horas/minutos" "$DURACION_ESPERADA" "$DURACION_TEXTO"
else
  check "duración coherente con horas/minutos" "entero" "$DURACION_MIN"
fi

if [ "$CITAS_TOTAL" = "0" ]; then
  check "Sin citas: duración promedio 0"      0           "$DURACION_MIN"
  check "Sin citas: texto de duración"        "0 h 0 min" "$DURACION_TEXTO"
  check "Sin citas: confirmadas 0 %"          0           $(echo "$RESP" | jq -r '.data.porcentajes.citasConfirmadas' 2>/dev/null)
fi

echo
echo "== Endpoint antiguo eliminado =="
check "GET /api/dashboard/stats ya no existe → 404" 404 $(code "${A[@]}" "$STATS_VIEJO")

echo
echo "Resultado: $ok ✅  $fail ❌"
[ "$fail" -eq 0 ]
