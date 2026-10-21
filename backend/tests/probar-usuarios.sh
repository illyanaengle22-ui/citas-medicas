#!/bin/bash
# Uso: ADMIN='token' PAC='token' bash probar-usuarios.sh
BASE=http://localhost:4000/api/usuarios
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
  curl -s -H "Authorization: Bearer $1" "$2" | jq --argjson id "$3" '(.data.data // [] | map(.id) | index($id)) != null'
}

echo "== Autenticación y permisos =="
check "Sin token → 401"                 401 $(code $BASE)
check "Paciente puede listar → 403"     403 $(code "${P[@]}" $BASE)
check "Admin puede listar → 200"        200 $(code "${A[@]}" $BASE)
check "Paciente no puede crear → 403"   403 $(code "${P[@]}" -X POST $BASE -d '{"nombre":"X","email":"x@x.com","password":"12345678","rol_id":3}')
check "Paciente no puede editar → 403"  403 $(code "${P[@]}" -X PUT $BASE/1 -d '{"nombre":"X"}')
check "Paciente no puede cambiar rol → 403" 403 $(code "${P[@]}" -X PUT $BASE/1/rol -d '{"rol_id":2}')

echo "== Crear y validar =="
check "Crear sin nombre → 400"          400 $(code "${A[@]}" -X POST $BASE -d '{}')
R=$(curl -s "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Prueba $S\",\"email\":\"prueba$S@test.com\",\"password\":\"password123\",\"rol_id\":3}")
ID=$(echo "$R" | jq -r '.data.id')
check "Crear paciente → id numérico" true $([[ "$ID" =~ ^[0-9]+$ ]] && echo true || echo false)
check "Crear admin → 201" 201 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Admin $S\",\"email\":\"admin$S@test.com\",\"password\":\"password123\",\"rol_id\":1}")
check "Crear médico → 400"              400 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Med $S\",\"email\":\"med$S@test.com\",\"password\":\"password123\",\"rol_id\":2}")
check "Duplicado email (mayúsculas) → 409" 409 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Dup\",\"email\":\"PRUEBA$S@TEST.COM\",\"password\":\"password123\",\"rol_id\":3}")
check "Duplicado email (espacios) → 409" 409 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Dup\",\"email\":\" prueba$S@test.com \",\"password\":\"password123\",\"rol_id\":3}")

echo "== Editar =="
check "Editar nombre → 200"             200 $(code "${A[@]}" -X PUT $BASE/$ID -d "{\"nombre\":\"Prueba $S b\"}")
check "Editar email → 200"              200 $(code "${A[@]}" -X PUT $BASE/$ID -d "{\"email\":\"nuevo$S@test.com\"}")
check "Editar con password corto → 400" 400 $(code "${A[@]}" -X PUT $BASE/$ID -d "{\"password\":\"123\"}")
check "Editar con password válido → 200" 200 $(code "${A[@]}" -X PUT $BASE/$ID -d "{\"password\":\"nuevapassword123\"}")
ID2=$(curl -s "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Segunda $S\",\"email\":\"segunda$S@test.com\",\"password\":\"password123\",\"rol_id\":3}" | jq -r '.data.id')
check "Editar con email existente → 409" 409 $(code "${A[@]}" -X PUT $BASE/$ID2 -d "{\"email\":\"nuevo$S@test.com\"}")
check "Editar id inexistente → 404"     404 $(code "${A[@]}" -X PUT $BASE/9999 -d '{"nombre":"Z"}')

echo "== Cambiar rol =="
check "Cambiar a paciente → 200"        200 $(code "${A[@]}" -X PUT $BASE/$ID/rol -d '{"rol_id":3}')
check "Cambiar a admin → 200"           200 $(code "${A[@]}" -X PUT $BASE/$ID/rol -d '{"rol_id":1}')
check "Cambiar a médico → 409"          409 $(code "${A[@]}" -X PUT $BASE/$ID/rol -d '{"rol_id":2}')
check "Admin no puede cambiar su rol → 400" 400 $(code "${A[@]}" -X PUT $BASE/1/rol -d '{"rol_id":3}')
check "Cambiar rol inexistente → 400"   400 $(code "${A[@]}" -X PUT $BASE/$ID/rol -d '{"rol_id":99}')
check "Cambiar rol id inválido → 400"   400 $(code "${A[@]}" -X PUT $BASE/abc/rol -d '{"rol_id":1}')

echo "== Detalle y búsqueda =="
check "GET /:id → 200"                  200 $(code "${A[@]}" $BASE/$ID)
check "GET /:id incluye ultimo_login" true $(curl -s "${A[@]}" $BASE/$ID | jq '.data | has("ultimo_login")')
check "Búsqueda ?q= → 200"              200 $(code "${A[@]}" "$BASE?q=Prueba")
check "Paginación ?page=1&limit=1 → 200" 200 $(code "${A[@]}" "$BASE?page=1&limit=1")
check "Paginación devuelve total"       true $(curl -s "${A[@]}" "$BASE?limit=1" | jq '.data.total != null')

echo "== Eliminar (soft delete) =="
check "Eliminar otro usuario → 200"     200 $(code "${A[@]}" -X DELETE $BASE/$ID2)
check "Eliminado NO sale en listado" false $(en_lista $ADMIN $BASE $ID2)
check "Eliminado NO sale con ?q= " false $(en_lista $ADMIN "$BASE?q=Segunda" $ID2)
check "Eliminado email libre para reuso → 201" 201 $(code "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Reuso $S\",\"email\":\"segunda$S@test.com\",\"password\":\"password123\",\"rol_id\":3}")
check "Auto-eliminación bloqueada → 400" 400 $(code "${A[@]}" -X DELETE $BASE/2)
check "Eliminar id inexistente → 404"   404 $(code "${A[@]}" -X DELETE $BASE/9999)

echo "== Login bloqueado para eliminados y pendientes =="
# Crear usuario pendiente vía registro público (estado_id=1 por defecto)
PEND_EMAIL="pend$S@test.com"
curl -s -X POST http://localhost:4000/api/auth/registrar -H "Content-Type: application/json" -d "{\"nombre\":\"Pendiente $S\",\"email\":\"$PEND_EMAIL\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}" >/dev/null
check "Login pendiente → 403" 403 $(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"pend$S@test.com\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}")

# Crear y eliminar usuario (soft delete)
DEL_EMAIL="del$S@test.com"
DEL_ID=$(curl -s "${A[@]}" -X POST $BASE -d "{\"nombre\":\"Del $S\",\"email\":\"$DEL_EMAIL\",\"password\":\"password123\",\"rol_id\":3}" | jq -r '.data.id')
curl -s -X DELETE "$BASE/$DEL_ID" "${A[@]}" >/dev/null
check "Login eliminado → 401" 401 $(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$DEL_EMAIL\",\"password\":\"password123\",\"captchaId\":\"test\",\"captchaTexto\":\"test\"}")

echo "== Ausencia de password_hash en respuestas =="
check "Listar no tiene password_hash" true $(curl -s "${A[@]}" $BASE | jq -e '(.data.data // [] | map(has("password_hash")) | any) | not')
check "Detalle no tiene password_hash" true $(curl -s "${A[@]}" $BASE/1 | jq 'has("password_hash") | not')
check "Crear no tiene password_hash" true $(curl -s "${A[@]}" -X POST $BASE -d "{\"nombre\":\"X$S\",\"email\":\"x$S@x.com\",\"password\":\"password123\",\"rol_id\":3}" | jq 'has("password_hash") | not')
check "Editar no tiene password_hash" true $(curl -s "${A[@]}" -X PUT $BASE/1 -d '{"nombre":"Y"}' | jq 'has("password_hash") | not')

echo "== Validación IDs =="
check "id abc → 400" 400 $(code "${A[@]}" $BASE/abc)
check "id 999999999 → 404" 404 $(code "${A[@]}" $BASE/999999999)
check "id -5 → 400" 400 $(code "${A[@]}" $BASE/-5)
check "PUT id abc → 400" 400 $(code "${A[@]}" -X PUT $BASE/abc -d '{"nombre":"X"}')
check "DELETE id abc → 400" 400 $(code "${A[@]}" -X DELETE $BASE/abc)

echo "== Sin 500 con error.message interno =="
check "Error 404 no expone stack" true $(curl -s "${A[@]}" $BASE/9999 | jq 'has("error") | not')

# Limpieza
for i in $ID $ID2; do code "${A[@]}" -X DELETE $BASE/$i >/dev/null; done

echo; echo "Resultado: $ok ✅  $fail ❌"