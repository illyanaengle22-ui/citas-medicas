-- =====================================================================
-- MIGRACIÓN 004 — Códigos de vinculación Telegram
-- =====================================================================
-- RN-116: código de un solo uso, 15 minutos, un código activo por paciente.
-- Se persiste en PostgreSQL para sobrevivir reinicios del backend y para
-- que varias instancias compartan el mismo estado.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS telegram_codigos (
  codigo        VARCHAR(6) PRIMARY KEY,
  paciente_id   BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en     TIMESTAMPTZ NOT NULL,
  usado_en      TIMESTAMPTZ,
  usado_chat_id VARCHAR(50),

  CONSTRAINT chk_telegram_codigos_codigo
    CHECK (codigo = upper(codigo) AND char_length(codigo) = 6),
  CONSTRAINT chk_telegram_codigos_expira
    CHECK (expira_en > creado_en)
);

-- Un solo código activo por paciente. Los códigos ya usados se conservan
-- para poder responder de forma idempotente ante un reintento del mismo chat.
CREATE UNIQUE INDEX IF NOT EXISTS ux_telegram_codigos_paciente_activo
  ON telegram_codigos (paciente_id)
  WHERE usado_en IS NULL;

CREATE INDEX IF NOT EXISTS ix_telegram_codigos_expira
  ON telegram_codigos (expira_en)
  WHERE usado_en IS NULL;

COMMIT;
