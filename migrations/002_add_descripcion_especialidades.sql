-- =====================================================================
-- MIGRACIÓN 002 — Descripción de especialidades
-- =====================================================================
-- RN-030b: la descripción es opcional y de máximo 500 caracteres.
-- El backend (PostgresEspecialidadRepository) y el frontend
-- (AdminEspecialidades) ya soportaban el campo; faltaba la columna.
-- =====================================================================

BEGIN;

ALTER TABLE especialidades
  ADD COLUMN IF NOT EXISTS descripcion VARCHAR(500);

COMMIT;
