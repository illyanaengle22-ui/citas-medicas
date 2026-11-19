#!/usr/bin/env bash
# ==============================================================================
# Script de compilación del Informe Técnico (MediCitas - Taller 3)
# Renderiza diagramas Mermaid (.mmd -> .png) y compila Markdown a DOCX con pandoc.
# ==============================================================================
set -euo pipefail

# Cargar NVM si existe en el entorno del usuario
if [ -s "${HOME:-}/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  . "$HOME/.nvm/nvm.sh" 2>/dev/null || true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIAGRAMAS_DIR="$SCRIPT_DIR/diagramas"
IMG_DIR="$SCRIPT_DIR/img"
INFORME_MD="$SCRIPT_DIR/informe.md"
SALIDA_DOCX="$SCRIPT_DIR/informe.docx"

echo "=============================================================================="
echo "▶ Verificando herramientas necesarias..."
echo "=============================================================================="

if ! command -v mmdc >/dev/null 2>&1; then
  echo "❌ Error: 'mmdc' (Mermaid CLI) no está instalado o no se encuentra en el PATH."
  echo "   Instálalo globalmente con: npm install -g @mermaid-js/mermaid-cli"
  exit 1
fi

if ! command -v pandoc >/dev/null 2>&1; then
  echo "❌ Error: 'pandoc' no está instalado o no se encuentra en el PATH."
  echo "   Descárgalo e instálalo desde: https://pandoc.org/installing.html"
  exit 1
fi

echo "✅ Herramientas verificadas: mmdc y pandoc están disponibles."
mkdir -p "$IMG_DIR"

echo
echo "=============================================================================="
echo "▶ Renderizando diagramas Mermaid a PNG (-s 3, fondo blanco)..."
echo "=============================================================================="

for mmd_file in "$DIAGRAMAS_DIR"/*.mmd; do
  if [ -f "$mmd_file" ]; then
    base_name="$(basename "$mmd_file" .mmd)"
    out_png="$IMG_DIR/${base_name}.png"
    echo "  → Procesando: $base_name.mmd -> img/${base_name}.png"
    mmdc -p "$SCRIPT_DIR/puppeteer-config.json" -i "$mmd_file" -o "$out_png" -s 3 --size 3000 -b white
  fi
done

echo "✅ Todos los diagramas fueron renderizados exitosamente en $IMG_DIR."

echo
echo "=============================================================================="
echo "▶ Compilando informe técnico a DOCX con pandoc..."
echo "=============================================================================="

if [ ! -f "$INFORME_MD" ]; then
  echo "❌ Error: No se encuentra el archivo principal $INFORME_MD"
  exit 1
fi

pandoc "$INFORME_MD" \
  -o "$SALIDA_DOCX" \
  --toc \
  --number-sections \
  --resource-path="$SCRIPT_DIR:$IMG_DIR"

echo "=============================================================================="
echo "🎉 ¡Compilación finalizada con éxito!"
echo "   Documento generado: $SALIDA_DOCX"
echo "=============================================================================="
