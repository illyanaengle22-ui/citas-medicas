#!/bin/bash
# Uso: ADMIN='token' PAC='token' bash probar-consultorios.sh
BASE=http://localhost:4000/api/consultorios
S=$RANDOM
ok=0; fail=0

if [ -z "$ADMIN" ] || [ -z "$PAC" ]; then
  echo "❌ Faltan tokens. Uso: ADMIN='token' PAC='token' bash probar-consultorios.sh"
  exit 1
fi

check() { # descripción, esperado, obtenido
  if [ "$2" = "$3" ]; then echo "✅ $1"; ok=$((ok+1))
  else echo "❌ $1 (esperado: $2, obtuvo: $3)"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
A=(-H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json")
P=(-H "Authorization: Bearer $PAC" -H "Content-Type: application/json")
# consultorios.id es BIGINT: node-postgres lo devuelve como string, por eso se
# compara con --arg (texto) y no con --argjson (número).
en_lista() { # token, url, id → true/false
  curl -s -H "Authorization: Bearer $1" "$2" | jq --arg id "$3" '(.data // [] | map(.id) | index($id)) != null'
}
# Comprueba directamente en la base que la fila sigue existiendo (borrado lógico).
fila_en_bd() { # id → true/false
  ( cd "$(dirname "$0")/.." && node -e "
    const db = require('./src/infrastructure/db');
    db.query('SELECT 1 FROM consultorios WHERE id = \$1', [process.argv[1]])
      .then(r => { console.log('RESULT:' + (r.rows.length > 0)); process.exit(0); })
      .catch(() => { console.log('RESULT:false'); process.exit(0); });
  " "$1" 2>/dev/null ) | grep -o 'RESULT:[a-z]*' | cut -d: -f2 | tail -1
}
campo() { # token, url, jq → valor
  curl -s -H "Authorization: Bearer $1" "$2" | jq -r "$3"
}

echo "== Autenticación y permisos =="
check "Sin token → 401"                       401 $(code $BASE)
check "Paciente puede listar → 200"           200 $(code "${P[@]}" $BASE)
check "Admin puede listar → 200"              200 $(code "${A[@]}" $BASE)
check "Paciente no puede crear → 403"         403 $(code "${P[@]}" -X POST $BASE -d '{"nombre":"X","direccion":"Y"}')
check "Paciente no puede editar → 403"        403 $(code "${P[@]}" -X PUT $BASE/1 -d '{"nombre":"X","direccion":"Y"}')
check "Paciente no puede cambiar estado → 403" 403 $(code "${P[@]}" -X PATCH $BASE/1/estado -d '{"activo":false}')
check "Paciente no puede borrar → 403"        403 $(code "${P[@]}" -X DELETE $BASE/1)

echo "== Crear y validar =="
check "Crear sin nombre → 400"                400 $(code "${A[@]}" -X POST $BASE -d '{"direccion":"Calle 1"}')
check "Crear sin dirección → 400"             400 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Sala $S\"}")
check "Crear teléfono inválido → 400"         400 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Sala $S\",\"direccion\":\"Calle 1\",\"telefono\":\"12-ab\"}")
R=$(curl -s "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Consultorio  $S\",\"direccion\":\"  Calle   1  \",\"telefono\":\"555-123-4567\"}")
ID=$(echo "$R" | jq -r '.data.id')
check "Crear consultorio → id numérico"       true $([[ "$ID" =~ ^[0-9]+$ ]] && echo true || echo false)
check "Nombre colapsa espacios"               "Consultorio $S" "$(echo "$R" | jq -r '.data.nombre')"
check "Teléfono solo con dígitos"             "5551234567" "$(echo "$R" | jq -r '.data.telefono')"
check "Duplicado en mayúsculas → 409"         409 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"CONSULTORIO $S\",\"direccion\":\"Otra\"}")
check "Duplicado con espacios → 409"          409 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"  consultorio   $S \",\"direccion\":\"Otra\"}")

echo "== Editar =="
ID2=$(curl -s "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Anexo $S\",\"direccion\":\"Calle 2\"}" | jq -r '.data.id')
check "Editar nombre y dirección → 200"       200 $(code "${A[@]}" -X PUT $BASE/$ID2 -d "{\"nombre\":\"Anexo $S b\",\"direccion\":\"Calle 3\"}")
check "Editar sin nombre → 400"               400 $(code "${A[@]}" -X PUT $BASE/$ID2 -d '{"direccion":"Calle 3"}')
check "Editar sin dirección → 400"            400 $(code "${A[@]}" -X PUT $BASE/$ID2 -d "{\"nombre\":\"Anexo $S c\"}")
check "Editar teléfono inválido → 400"        400 $(code "${A[@]}" -X PUT $BASE/$ID2 -d "{\"nombre\":\"Anexo $S c\",\"direccion\":\"Calle 3\",\"telefono\":\"123\"}")
check "Editar nombre duplicado → 409"         409 $(code "${A[@]}" -X PUT $BASE/$ID2 -d "{\"nombre\":\"consultorio $S\",\"direccion\":\"Calle 3\"}")
check "Editar id inexistente → 404"           404 $(code "${A[@]}" -X PUT $BASE/999999 -d '{"nombre":"Z","direccion":"Z"}')

echo "== Estado =="
check "activo inválido → 400"                 400 $(code "${A[@]}" -X PATCH $BASE/$ID/estado -d '{"activo":"si"}')
check "PATCH id inexistente → 404"            404 $(code "${A[@]}" -X PATCH $BASE/999999/estado -d '{"activo":false}')
check "Desactivar → 200"                      200 $(code "${A[@]}" -X PATCH $BASE/$ID/estado -d '{"activo":false}')
check "Inactivo NO sale en listado normal (admin)" false $(en_lista $ADMIN $BASE $ID)
check "Inactivo NO sale al paciente aunque pida ?todos=true" false $(en_lista $PAC "$BASE?todos=true" $ID)
check "Admin con ?todos=true SÍ lo ve"        true  $(en_lista $ADMIN "$BASE?todos=true" $ID)
check "Reactivar → 200"                       200 $(code "${A[@]}" -X PATCH $BASE/$ID/estado -d '{"activo":true}')
check "Reactivado vuelve al listado"          true  $(en_lista $ADMIN $BASE $ID)

echo "== Búsqueda =="
check "?q= por nombre lo encuentra"           true  $(en_lista $ADMIN "$BASE?q=consultorio%20$S" $ID)
check "?q= inexistente no devuelve nada"      false $(en_lista $ADMIN "$BASE?q=zzz$S" $ID)

echo "== Borrado lógico =="
check "Eliminar → 200"                        200 $(code "${A[@]}" -X DELETE $BASE/$ID)
check "Eliminado NO sale en listado"          false $(en_lista $ADMIN $BASE $ID)
check "Eliminado NO sale con ?todos=true"     false $(en_lista $ADMIN "$BASE?todos=true" $ID)
check "Eliminado NO sale con ?q="             false $(en_lista $ADMIN "$BASE?q=consultorio%20$S" $ID)
check "GET /:id de eliminado → 404"           404 $(code "${A[@]}" $BASE/$ID)
check "La fila sigue en la base"              true  $(fila_en_bd $ID)
ID3=$(curl -s "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Consultorio $S\",\"direccion\":\"Calle 9\"}" | jq -r '.data.id')
check "Nombre reutilizable tras el borrado → 201" true $([[ "$ID3" =~ ^[0-9]+$ ]] && echo true || echo false)
check "Eliminar id inexistente → 404"         404 $(code "${A[@]}" -X DELETE $BASE/999999)

echo "== Ids y errores en JSON =="
check "Id inválido → 400"                     400 $(code "${A[@]}" $BASE/abc)
check "Id fuera de rango (bigint) → 400"      400 $(code "${A[@]}" $BASE/99999999999999999999)
check "Id grande válido (bigint) → 404"       404 $(code "${A[@]}" $BASE/3000000000)
check "Ruta inexistente responde JSON ok=false" false $(curl -s http://localhost:4000/api/no-existe | jq -r '.ok' 2>/dev/null)
check "Ninguna respuesta de error expone 'error:' interno" true \
  $(curl -s "${A[@]}" $BASE/abc | jq 'has("error") | not' 2>/dev/null)

# Limpieza: se hace borrado lógico de lo que quedó vivo
for i in $ID2 $ID3; do code "${A[@]}" -X DELETE $BASE/$i >/dev/null; done

echo; echo "Resultado: $ok ✅  $fail ❌"
