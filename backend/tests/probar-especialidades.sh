#!/bin/bash
# Uso: ADMIN='token' PAC='token' bash probar-especialidades.sh
BASE=http://localhost:4000/api/especialidades
S=$RANDOM
ok=0; fail=0

check() { # descripción, esperado, obtenido
  if [ "$2" = "$3" ]; then echo "✅ $1"; ok=$((ok+1))
  else echo "❌ $1 (esperado: $2, obtuvo: $3)"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
A=(-H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json")
P=(-H "Authorization: Bearer $PAC" -H "Content-Type: application/json")
en_lista() { # token, url, id → true/false
  curl -s -H "Authorization: Bearer $1" "$2" | jq --argjson id "$3" '[.data[].id] | index($id) != null'
}

echo "== Autenticación y permisos =="
check "Sin token → 401"                 401 $(code $BASE)
check "Paciente puede listar → 200"     200 $(code "${P[@]}" $BASE)
check "Admin puede listar → 200"        200 $(code "${A[@]}" $BASE)
check "Paciente no puede crear → 403"   403 $(code "${P[@]}" -X POST $BASE -d '{"nombre":"X"}')
check "Paciente no puede editar → 403"  403 $(code "${P[@]}" -X PUT $BASE/1 -d '{"nombre":"X"}')
check "Paciente no puede cambiar estado → 403" 403 $(code "${P[@]}" -X PATCH $BASE/1/estado -d '{"activo":false}')

echo "== Crear y validar =="
check "Crear sin nombre → 400"          400 $(code "${A[@]}" -X POST $BASE -d '{}')
R=$(curl -s "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Prueba $S\"}")
ID=$(echo "$R" | jq -r '.data.id')
check "Crear especialidad → id numérico" true $([[ "$ID" =~ ^[0-9]+$ ]] && echo true || echo false)
check "Duplicado en mayúsculas → 409"   409 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"PRUEBA $S\"}")
check "Duplicado con espacios → 409"    409 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"  prueba   $S \"}")

echo "== Editar =="
check "Editar nombre → 200"             200 $(code "${A[@]}" -X PUT $BASE/$ID -d "{\"nombre\":\"Prueba $S b\"}")
ID2=$(curl -s "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Segunda $S\"}" | jq -r '.data.id')
check "Editar con nombre existente → 409" 409 $(code "${A[@]}" -X PUT $BASE/$ID2 -d "{\"nombre\":\"PRUEBA $S B\"}")
check "Editar sin nombre → 400"         400 $(code "${A[@]}" -X PUT $BASE/$ID -d '{}')
check "Editar id inexistente → 404"     404 $(code "${A[@]}" -X PUT $BASE/9999 -d '{"nombre":"Z"}')

echo "== Estado (RN-031) =="
check "activo inválido → 400"           400 $(code "${A[@]}" -X PATCH $BASE/$ID/estado -d '{"activo":"si"}')
check "PATCH id inexistente → 404"      404 $(code "${A[@]}" -X PATCH $BASE/9999/estado -d '{"activo":false}')
check "Desactivar → 200"                200 $(code "${A[@]}" -X PATCH $BASE/$ID/estado -d '{"activo":false}')
check "Inactiva NO sale en listado normal (admin)" false $(en_lista $ADMIN $BASE $ID)
check "Inactiva NO sale al paciente aunque pida ?todas=true" false $(en_lista $PAC "$BASE?todas=true" $ID)
check "Admin con ?todas=true SÍ la ve"  true  $(en_lista $ADMIN "$BASE?todas=true" $ID)
check "Reactivar → 200"                 200 $(code "${A[@]}" -X PATCH $BASE/$ID/estado -d '{"activo":true}')
check "Reactivada vuelve al listado"    true  $(en_lista $ADMIN $BASE $ID)

echo "== Sin borrado físico y errores en JSON =="
check "DELETE ya no existe → 404"       404 $(code "${A[@]}" -X DELETE $BASE/$ID)
check "Ruta inexistente responde JSON ok=false" false $(curl -s http://localhost:4000/api/no-existe | jq -r '.ok' 2>/dev/null)
check "Ninguna respuesta de error expone 'error:' interno" true \
  $(curl -s "${A[@]}" $BASE/abc | jq 'has("error") | not' 2>/dev/null)

# Limpieza: se desactivan (no se borran)
for i in $ID $ID2; do code "${A[@]}" -X PATCH $BASE/$i/estado -d '{"activo":false}' >/dev/null; done

echo; echo "Resultado: $ok ✅  $fail ❌"
