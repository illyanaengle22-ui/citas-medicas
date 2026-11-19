-- Migración 005: foto de perfil y costo de consulta para médicos
-- Es idempotente: se puede ejecutar varias veces sin fallar.
--
-- Nota: foto_url ya fue creada por la migración 003 con VARCHAR(500).
-- Si ya existe, se conserva su tipo actual para no truncar datos.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'medicos'
      AND column_name = 'foto_url'
  ) THEN
    ALTER TABLE medicos ADD COLUMN foto_url VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'medicos'
      AND column_name = 'costo_consulta'
  ) THEN
    ALTER TABLE medicos ADD COLUMN costo_consulta DECIMAL(10,2);
  END IF;
END $$;
