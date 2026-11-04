#!/usr/bin/env bash
# ==============================================================================
# MediCitas — Compilación y Publicación a Ramas Orphan de Despliegue
# ==============================================================================
# Ejecutar en WSL / Linux en la rama feature/gestion-clinica:
#   bash deploy/build-y-publicar.sh
# ==============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BRANCH_ORIGEN="$(git branch --show-current 2>/dev/null || echo "")"
if [ "$BRANCH_ORIGEN" != "feature/gestion-clinica" ]; then
  echo "⚠️ Advertencia: Estás en la rama '$BRANCH_ORIGEN'."
  echo "   La rama de desarrollo recomendada es 'feature/gestion-clinica'."
  read -p "¿Deseas continuar desde la rama actual ($BRANCH_ORIGEN)? [s/N]: " RESP
  if [[ ! "$RESP" =~ ^[sS]$ ]]; then
    exit 1
  fi
fi

echo "=========================================================="
echo "  🚀 [1/5] Compilando Frontend (Vite) y Backend (esbuild)..."
echo "=========================================================="

# 1. Compilación de Frontend
echo "📦 Construyendo Frontend..."
cd "$REPO_ROOT/frontend"
npm install --silent
npm run build

# Verificación de fugas de IP o localhost en el bundle de frontend
echo "🔍 Verificando que dist no contenga IPs privadas ni localhost..."
if grep -rn "http://localhost" dist/ 2>/dev/null || grep -rn "127.0.0.1" dist/ 2>/dev/null; then
  echo "❌ Error: Se detectaron referencias a localhost o 127.0.0.1 en dist/."
  exit 1
fi
echo "✅ Frontend compilado sin referencias hardcodeadas."

# 2. Compilación de Backend
echo "📦 Construyendo Backend con esbuild..."
cd "$REPO_ROOT/backend"
npx esbuild src/server.js \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --external:pg-native \
  --external:svg-captcha \
  --outfile=dist/server.js

# Verificación rápida del bundle de backend
echo "🔍 Verificando sintaxis del bundle de backend..."
node -c dist/server.js
echo "✅ Backend compilado correctamente (dist/server.js)."

echo "=========================================================="
echo "  📁 [2/5] Organizando artefactos en directorio temporal..."
echo "=========================================================="
TMP_DIR="/tmp/medicitas_deploy_$(date +%s)"
mkdir -p "$TMP_DIR/db/migrations" "$TMP_DIR/db/db" "$TMP_DIR/db/deploy"
mkdir -p "$TMP_DIR/back/dist" "$TMP_DIR/back/deploy"
mkdir -p "$TMP_DIR/front/dist" "$TMP_DIR/front/deploy/nginx"
mkdir -p "$TMP_DIR/n8n/deploy"

# Artefactos DB
cp "$REPO_ROOT/backend/migrations/"*.sql "$TMP_DIR/db/migrations/"
cp "$REPO_ROOT/db/seed_demo.sql" "$TMP_DIR/db/db/"
cp "$REPO_ROOT/deploy/deploy-db.sh" "$TMP_DIR/db/deploy/"
cat << 'EOF' > "$TMP_DIR/db/.gitignore"
*.log
.DS_Store
EOF

# Artefactos Backend
cp "$REPO_ROOT/backend/dist/server.js" "$TMP_DIR/back/dist/"
cp "$REPO_ROOT/deploy/deploy-back.sh" "$TMP_DIR/back/deploy/"
cat << 'EOF' > "$TMP_DIR/back/package.json"
{
  "name": "citas-medicas-backend-prod",
  "version": "1.0.0",
  "description": "Backend compilado para producción",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js"
  },
  "dependencies": {
    "svg-captcha": "^1.4.0"
  }
}
EOF
cat << 'EOF' > "$TMP_DIR/back/.gitignore"
node_modules/
.env
uploads/
*.log
.DS_Store
EOF

# Artefactos Frontend
cp -r "$REPO_ROOT/frontend/dist/"* "$TMP_DIR/front/dist/"
cp "$REPO_ROOT/deploy/nginx/app.conf.template" "$TMP_DIR/front/deploy/nginx/"
cp "$REPO_ROOT/deploy/deploy-front.sh" "$TMP_DIR/front/deploy/"
cat << 'EOF' > "$TMP_DIR/front/.gitignore"
*.log
.DS_Store
EOF

# Artefactos n8n
cp "$REPO_ROOT/MediCitas.json" "$TMP_DIR/n8n/"
cp "$REPO_ROOT/deploy/deploy-n8n.sh" "$TMP_DIR/n8n/deploy/"
cat << 'EOF' > "$TMP_DIR/n8n/.gitignore"
docker-compose.yml
credentials*.json
*.log
.DS_Store
EOF

echo "✅ Artefactos aislados en $TMP_DIR."

echo "=========================================================="
echo "  🌿 [3/5] Publicando ramas orphan a GitHub..."
echo "=========================================================="

publicar_rama() {
  local RAMA="$1"
  local ORIGEN_DIR="$2"

  echo ""
  echo "--- Publicando rama orphan: $RAMA ---"
  cd "$REPO_ROOT"

  # Crear o cambiar a la rama
  if git show-ref --quiet --heads "$RAMA"; then
    git checkout -f "$RAMA"
  else
    git checkout --orphan "$RAMA"
  fi

  # Limpiar el índice y directorio de trabajo de la rama
  git rm -rf . 2>/dev/null || true
  find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

  # Copiar artefactos
  cp -r "$ORIGEN_DIR/"* .
  cp "$ORIGEN_DIR/.gitignore" . 2>/dev/null || true

  # Asegurar permisos ejecutables en scripts
  if [ -d "deploy" ]; then
    chmod +x deploy/*.sh 2>/dev/null || true
    for s in deploy/*.sh; do
      if [ -f "$s" ]; then git update-index --chmod=+x "$s"; fi
    done
  fi

  # git add por rutas específicas para no colar nada
  git add .gitignore 2>/dev/null || true
  if [ -d "migrations" ]; then git add migrations/; fi
  if [ -d "db" ]; then git add db/; fi
  if [ -d "dist" ]; then git add dist/; fi
  if [ -d "deploy" ]; then git add deploy/; fi
  if [ -f "package.json" ]; then git add package.json; fi
  if [ -f "MediCitas.json" ]; then git add MediCitas.json; fi

  # Verificación estricta: NO debe existir src/, ni .env, ni node_modules
  if [ -d "src" ] || [ -f ".env" ] || [ -d "node_modules" ]; then
    echo "❌ Error de seguridad: Se detectaron archivos prohibidos (src, .env o node_modules) en $RAMA."
    exit 1
  fi

  git commit -m "Deploy artefactos: $RAMA [$(date +'%Y-%m-%d %H:%M')]" || true

  echo "   Verificando contenido de $RAMA:"
  git ls-tree -r --name-only HEAD

  git push -u origin "$RAMA" --force
  echo "✅ Rama $RAMA publicada exitosamente."
}

publicar_rama "deploy/db" "$TMP_DIR/db"
publicar_rama "deploy/back" "$TMP_DIR/back"
publicar_rama "deploy/front" "$TMP_DIR/front"
publicar_rama "deploy/n8n" "$TMP_DIR/n8n"

# Limpieza
rm -rf "$TMP_DIR"

echo "=========================================================="
echo "  🔙 [4/5] Regresando a la rama original ($BRANCH_ORIGEN)..."
echo "=========================================================="
cd "$REPO_ROOT"
git checkout -f "$BRANCH_ORIGEN"

echo "=========================================================="
echo "  🎉 [5/5] ¡Proceso completado con éxito!"
echo "=========================================================="
echo "Las 4 ramas orphan han sido compiladas y empujadas a GitHub:"
echo "  - deploy/db"
echo "  - deploy/back"
echo "  - deploy/front"
echo "  - deploy/n8n"
