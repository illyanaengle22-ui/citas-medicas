#!/usr/bin/env bash
# ==============================================================================
# MediCitas — Despliegue de Base de Datos (EC2 Ubuntu)
# ==============================================================================
set -euo pipefail

# Parámetros / Variables de entorno
DB_NAME="${DB_NAME:-citas_medicas}"
DB_USER="${DB_USER:-citas_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
CARGAR_DEMO="${CARGAR_DEMO:-0}"

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Error: La variable de entorno DB_PASSWORD es obligatoria."
  echo "   Uso: DB_PASSWORD='secreto' ADMIN_PASSWORD='pass' bash deploy/deploy-db.sh"
  exit 1
fi

echo "🔹 [1/6] Instalando PostgreSQL..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y postgresql postgresql-contrib

# Detectar versión instalada y rutas de configuración
PG_VER=$(psql --version | awk '{print $3}' | cut -d. -f1)
PG_CONF_DIR=$(sudo find /etc/postgresql -name postgresql.conf -exec dirname {} \; | head -n 1)

echo "🔹 [2/6] Configurando red y accesos (172.31.0.0/16)..."
# listen_addresses = '*'
sudo sed -i "s/^#listen_addresses = .*/listen_addresses = '*'/" "$PG_CONF_DIR/postgresql.conf"
sudo sed -i "s/^listen_addresses = .*/listen_addresses = '*'/" "$PG_CONF_DIR/postgresql.conf"

# pg_hba.conf: permitir conexión desde la subred privada de AWS Academy (172.31.0.0/16)
if ! sudo grep -q "172.31.0.0/16" "$PG_CONF_DIR/pg_hba.conf"; then
  echo "host    $DB_NAME    $DB_USER    172.31.0.0/16    scram-sha-256" | sudo tee -a "$PG_CONF_DIR/pg_hba.conf"
  echo "host    $DB_NAME    $DB_USER    127.0.0.1/32     scram-sha-256" | sudo tee -a "$PG_CONF_DIR/pg_hba.conf"
fi

sudo systemctl restart postgresql
sudo systemctl enable postgresql

echo "🔹 [3/6] Creando usuario, base de datos y zona horaria..."
# Crear usuario si no existe
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE;"

# Actualizar contraseña por si cambió
sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

# Crear BD si no existe
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

sudo -u postgres psql -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;"
sudo -u postgres psql -c "ALTER DATABASE $DB_NAME SET timezone TO 'America/Mexico_City';"

echo "🔹 [4/6] Habilitando extensiones de PostgreSQL..."
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS citext;"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

echo "🔹 [5/6] Ejecutando migraciones SQL..."
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../migrations" 2>/dev/null && pwd || echo "")"
if [ -z "$MIGRATIONS_DIR" ] || [ ! -d "$MIGRATIONS_DIR" ]; then
  # Si estamos en la raíz de la rama deploy/db
  MIGRATIONS_DIR="$(pwd)/migrations"
fi

if [ -d "$MIGRATIONS_DIR" ]; then
  for mig in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
    echo "   Aplicando: $(basename "$mig")"
    sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$mig" > /dev/null
  done
else
  echo "⚠️ No se encontró carpeta de migraciones en $MIGRATIONS_DIR"
fi

echo "🔹 [6/6] Configurando administrador inicial..."
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@clinica.com' AND deleted_at IS NULL) THEN
    INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
    VALUES ('Administrador', 'admin@clinica.com', crypt('$ADMIN_PASSWORD', gen_salt('bf', 10)), 1, 2);
    RAISE NOTICE 'Admin inicial creado (admin@clinica.com)';
  ELSE
    UPDATE usuarios 
    SET password_hash = crypt('$ADMIN_PASSWORD', gen_salt('bf', 10)), estado_id = 2, deleted_at = NULL
    WHERE email = 'admin@clinica.com';
    RAISE NOTICE 'Admin inicial actualizado';
  END IF;
END \$\$;
EOSQL

# Carga de datos de demo opcional
if [ "$CARGAR_DEMO" = "1" ]; then
  SEED_FILE="$(pwd)/db/seed_demo.sql"
  if [ -f "$SEED_FILE" ]; then
    echo "🌱 Cargando datos de demostración (CARGAR_DEMO=1)..."
    sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$SEED_FILE"
  fi
fi

echo ""
echo "✅ Base de datos configurada y lista en el puerto 5432."
echo "   Verificación rápida de tablas:"
sudo -u postgres psql -d "$DB_NAME" -c "\dt"
