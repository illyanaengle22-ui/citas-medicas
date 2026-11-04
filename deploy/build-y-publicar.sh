#!/usr/bin/env bash
# ==============================================================================
# MediCitas — Compilación y Publicación a Ramas Orphan de Despliegue
# ==============================================================================
# ESTRATEGIA:
#   1. Compila frontend (Vite) y backend (esbuild) IN-PLACE.
#   2. Copia artefactos a /tmp/artifacts.
#   3. Clona el repo LOCAL a /tmp/repo_clone (ext4, sin node_modules).
#   4. En /tmp/repo_clone crea las 4 ramas orphan con commits.
#   5. Desde el REPO ORIGINAL (que tiene credenciales) hace fetch del clon
#      y luego push a origin. Así no necesita credenciales en /tmp.
#   6. NUNCA cambia de rama en /mnt/c/... → el working tree queda intacto.
#
# Ejecutar en WSL / Linux:
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

# Asegurar que no hay cambios sin confirmar
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "⚠️ Hay cambios sin confirmar en el working tree."
  echo "   Haz commit o stash antes de ejecutar este script."
  exit 1
fi

REMOTE_URL="$(git remote get-url origin 2>/dev/null)"
if [ -z "$REMOTE_URL" ]; then
  echo "❌ No se detectó el remote 'origin'. Configura el repositorio remoto."
  exit 1
fi
echo "📡 Remote origin: $REMOTE_URL"

echo "=========================================================="
echo "  🚀 [1/5] Compilando Frontend (Vite) y Backend (esbuild)..."
echo "=========================================================="

# 1. Compilación de Frontend
echo "📦 Construyendo Frontend..."
cd "$REPO_ROOT/frontend"
npm install --silent
npm run build

# Verificación de fugas de IP o URLs de backend en el bundle
echo "🔍 Verificando que dist no contenga IPs privadas ni llamadas a backend..."
if grep -rnE "http://localhost:[0-9]+" dist/ 2>/dev/null || \
   grep -rnE "http://127\.0\.0\.1:[0-9]+" dist/ 2>/dev/null || \
   grep -rnE "http://(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)" dist/ 2>/dev/null; then
  echo "❌ Error: Se detectaron URLs de backend con puerto o IPs privadas en dist/."
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
  --packages=external \
  --outfile=dist/server.js

echo "🔍 Verificando sintaxis del bundle de backend..."
node -c dist/server.js
echo "✅ Backend compilado correctamente (dist/server.js)."

echo "=========================================================="
echo "  📁 [2/5] Organizando artefactos en directorio temporal..."
echo "=========================================================="
TMP_DIR="/tmp/medicitas_deploy_$(date +%s)"
mkdir -p "$TMP_DIR/artifacts/db/migrations" "$TMP_DIR/artifacts/db/db" "$TMP_DIR/artifacts/db/deploy"
mkdir -p "$TMP_DIR/artifacts/back/dist" "$TMP_DIR/artifacts/back/deploy"
mkdir -p "$TMP_DIR/artifacts/front/dist" "$TMP_DIR/artifacts/front/deploy/nginx"
mkdir -p "$TMP_DIR/artifacts/n8n/deploy"

# --- Artefactos DB ---
cp "$REPO_ROOT/backend/migrations/"*.sql "$TMP_DIR/artifacts/db/migrations/"
cp "$REPO_ROOT/db/seed_demo.sql" "$TMP_DIR/artifacts/db/db/"
cp "$REPO_ROOT/deploy/deploy-db.sh" "$TMP_DIR/artifacts/db/deploy/"
cat << 'EOF' > "$TMP_DIR/artifacts/db/.gitignore"
*.log
.DS_Store
EOF

# --- Artefactos Backend ---
cp "$REPO_ROOT/backend/dist/server.js" "$TMP_DIR/artifacts/back/dist/"
cp "$REPO_ROOT/deploy/deploy-back.sh" "$TMP_DIR/artifacts/back/deploy/"
cat << 'EOF' > "$TMP_DIR/artifacts/back/package.json"
{
  "name": "citas-medicas-backend-prod",
  "version": "1.0.0",
  "description": "Backend compilado para producción",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.6",
    "dotenv": "^18.0.5",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "multer": "^2.4.0",
    "pg": "^8.23.1",
    "svg-captcha": "^1.4.0"
  }
}
EOF
cat << 'EOF' > "$TMP_DIR/artifacts/back/.gitignore"
node_modules/
.env
uploads/
*.log
.DS_Store
EOF

# --- Artefactos Frontend ---
cp -r "$REPO_ROOT/frontend/dist/"* "$TMP_DIR/artifacts/front/dist/"
cp "$REPO_ROOT/deploy/nginx/app.conf.template" "$TMP_DIR/artifacts/front/deploy/nginx/"
cp "$REPO_ROOT/deploy/deploy-front.sh" "$TMP_DIR/artifacts/front/deploy/"
cat << 'EOF' > "$TMP_DIR/artifacts/front/.gitignore"
*.log
.DS_Store
EOF

# --- Artefactos n8n ---
cp "$REPO_ROOT/MediCitas.json" "$TMP_DIR/artifacts/n8n/"
cp "$REPO_ROOT/deploy/deploy-n8n.sh" "$TMP_DIR/artifacts/n8n/deploy/"
cat << 'EOF' > "$TMP_DIR/artifacts/n8n/.gitignore"
docker-compose.yml
credentials*.json
*.log
.DS_Store
EOF

echo "✅ Artefactos aislados en $TMP_DIR/artifacts."

echo "=========================================================="
echo "  🌿 [3/5] Creando ramas orphan en clon temporal..."
echo "=========================================================="

# Clonar repo localmente a /tmp (ext4 nativo — sin problemas con DrvFs)
CLONE_DIR="$TMP_DIR/repo_clone"
git clone --no-checkout "$REPO_ROOT" "$CLONE_DIR"
cd "$CLONE_DIR"

# Configurar identidad git
GIT_USER="$(cd "$REPO_ROOT" && git config user.name 2>/dev/null || echo "MediCitas Deploy")"
GIT_EMAIL="$(cd "$REPO_ROOT" && git config user.email 2>/dev/null || echo "deploy@medicitas.local")"
git config user.name "$GIT_USER"
git config user.email "$GIT_EMAIL"

crear_rama_orphan() {
  local RAMA="$1"
  local ORIGEN_DIR="$2"

  echo ""
  echo "--- Creando rama orphan: $RAMA ---"
  cd "$CLONE_DIR"

  # Crear rama orphan limpia
  git checkout --orphan "$RAMA"
  # Limpiar todo el índice y directorio
  git rm -rf . 2>/dev/null || true
  find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

  # Copiar artefactos
  cp -r "$ORIGEN_DIR/"* .
  cp "$ORIGEN_DIR/.gitignore" . 2>/dev/null || true

  # Permisos ejecutables en scripts de deploy
  if [ -d "deploy" ]; then
    chmod +x deploy/*.sh 2>/dev/null || true
  fi

  # Añadir todo al índice
  git add -A

  # Verificación estricta: NO debe existir src/, ni .env, ni node_modules
  if git ls-files --cached | grep -qE '^src/|^\.env$|^node_modules/'; then
    echo "❌ Error de seguridad: Se detectaron archivos prohibidos (src, .env o node_modules) en $RAMA."
    exit 1
  fi

  # Marcar scripts como ejecutables en el índice de git
  for s in $(git ls-files --cached 'deploy/*.sh'); do
    git update-index --chmod=+x "$s"
  done

  git commit -m "Deploy artefactos: $RAMA [$(date +'%Y-%m-%d %H:%M')]"

  echo "   Contenido de $RAMA:"
  git ls-tree -r --name-only HEAD
  echo "✅ Rama $RAMA creada localmente."
}

crear_rama_orphan "deploy/db"    "$TMP_DIR/artifacts/db"
crear_rama_orphan "deploy/back"  "$TMP_DIR/artifacts/back"
crear_rama_orphan "deploy/front" "$TMP_DIR/artifacts/front"
crear_rama_orphan "deploy/n8n"   "$TMP_DIR/artifacts/n8n"

echo "=========================================================="
echo "  📤 [4/5] Publicando ramas a GitHub (desde repo original)..."
echo "=========================================================="

# Volver al repo original que SÍ tiene credenciales configuradas
cd "$REPO_ROOT"

# Registrar el clon como remote temporal
git remote remove tmp_deploy 2>/dev/null || true
git remote add tmp_deploy "$CLONE_DIR"

# Fetch y push cada rama
for RAMA in deploy/db deploy/back deploy/front deploy/n8n; do
  echo "📤 Publicando $RAMA..."
  git fetch tmp_deploy "$RAMA":"$RAMA" --force
  git push origin "$RAMA" --force
  echo "✅ $RAMA publicada."
done

# Limpiar remote temporal y ramas locales
git remote remove tmp_deploy
for RAMA in deploy/db deploy/back deploy/front deploy/n8n; do
  git branch -D "$RAMA" 2>/dev/null || true
done

echo "=========================================================="
echo "  🧹 [5/5] Limpiando archivos temporales..."
echo "=========================================================="
rm -rf "$TMP_DIR"
echo "✅ Directorio temporal eliminado."

echo "=========================================================="
echo "  🎉 ¡Proceso completado con éxito!"
echo "=========================================================="
echo ""
echo "Las 4 ramas orphan han sido compiladas y empujadas a GitHub:"
echo "  - deploy/db"
echo "  - deploy/back"
echo "  - deploy/front"
echo "  - deploy/n8n"
echo ""
echo "Tu rama de trabajo ($BRANCH_ORIGEN) NO fue modificada."
echo ""
echo "📋 Siguiente paso: Despliega en AWS con los scripts de cada rama."
echo "   Consulta: deploy/deploy-db.sh, deploy-back.sh, deploy-front.sh, deploy-n8n.sh"
