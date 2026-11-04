-- Migración 003: Agregar foto_url a usuarios y medicos
-- Ejecutar manualmente: psql -U <user> -d <db> -f 003_add_foto_url.sql
-- Es idempotente: usa IF NOT EXISTS para no fallar si ya existe.

DO $$
BEGIN
  -- Agregar foto_url a la tabla usuarios
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'usuarios' AND column_name = 'foto_url'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN foto_url VARCHAR(500);
  END IF;

  -- Agregar foto_url a la tabla medicos (foto de portada del médico)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'medicos' AND column_name = 'foto_url'
  ) THEN
    ALTER TABLE medicos ADD COLUMN foto_url VARCHAR(500);
  END IF;
END $$;
