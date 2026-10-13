-- =====================================================================
-- SISTEMA DE CITAS MÉDICAS — Esquema de base de datos (PostgreSQL 14+)
-- =====================================================================
-- Convenciones:
--   * snake_case, tablas en plural
--   * BIGINT GENERATED ALWAYS AS IDENTITY como PK interna
--   * uuid_publico como identificador expuesto externamente (API, Telegram)
--   * Soft delete vía deleted_at + índices únicos parciales
--   * Catálogos editables como tablas, no como ENUM/CHECK fijos
--   * created_at / updated_at en toda tabla transaccional
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- EXTENSIONES
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;      -- email case-insensitive
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE con igualdad + rangos

-- ---------------------------------------------------------------------
-- Se crea todo en el schema "public" (el que usa pgAdmin4 por defecto).
-- ---------------------------------------------------------------------
SET search_path TO public;

-- ---------------------------------------------------------------------
-- FUNCIÓN GENÉRICA: mantener updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- CATÁLOGOS (tablas de referencia, editables por el admin sin migraciones)
-- =====================================================================

CREATE TABLE roles (
  id          SMALLINT PRIMARY KEY,
  clave       VARCHAR(20) NOT NULL UNIQUE,   -- 'admin' | 'medico' | 'paciente'
  descripcion VARCHAR(100) NOT NULL
);

INSERT INTO roles (id, clave, descripcion) VALUES
  (1, 'admin',    'Administrador del sistema'),
  (2, 'medico',   'Médico / profesional de la salud'),
  (3, 'paciente', 'Paciente');

CREATE TABLE estados_cuenta (
  id    SMALLINT PRIMARY KEY,
  clave VARCHAR(20) NOT NULL UNIQUE  -- 'pendiente' | 'activo' | 'rechazado'
);

INSERT INTO estados_cuenta (id, clave) VALUES
  (1, 'pendiente'), (2, 'activo'), (3, 'rechazado');

CREATE TABLE estados_cita (
  id    SMALLINT PRIMARY KEY,
  clave VARCHAR(20) NOT NULL UNIQUE
);

INSERT INTO estados_cita (id, clave) VALUES
  (1, 'pendiente'), (2, 'confirmada'), (3, 'reagendada'),
  (4, 'cancelada'), (5, 'completada'), (6, 'no_asistio');

CREATE TABLE especialidades (
  id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL UNIQUE,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- =====================================================================
-- USUARIOS (autenticación)
-- =====================================================================

CREATE TABLE usuarios (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid_publico   UUID NOT NULL DEFAULT gen_random_uuid(),
  nombre         VARCHAR(100)  NOT NULL,
  email          CITEXT        NOT NULL,
  password_hash  VARCHAR(255)  NOT NULL,
  rol_id         SMALLINT      NOT NULL REFERENCES roles(id),
  estado_id      SMALLINT      NOT NULL REFERENCES estados_cuenta(id) DEFAULT 1,
  ultimo_login   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX ux_usuarios_email_activo
  ON usuarios (email) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_usuarios_uuid ON usuarios (uuid_publico);
CREATE INDEX ix_usuarios_rol ON usuarios (rol_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- PACIENTES
-- =====================================================================

CREATE TABLE pacientes (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  telefono          VARCHAR(20),
  telegram_chat_id  VARCHAR(50),
  fecha_nacimiento  DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,

  CONSTRAINT uq_pacientes_usuario UNIQUE (usuario_id),
  CONSTRAINT chk_pacientes_fecha_nacimiento
    CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento <= CURRENT_DATE)
);

CREATE UNIQUE INDEX ux_pacientes_telegram
  ON pacientes (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

CREATE TRIGGER trg_pacientes_updated_at
  BEFORE UPDATE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- MÉDICOS
-- =====================================================================

CREATE TABLE medicos (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id          BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cedula_profesional  VARCHAR(50) NOT NULL,
  telefono            VARCHAR(20),
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT uq_medicos_usuario UNIQUE (usuario_id)
);

CREATE UNIQUE INDEX ux_medicos_cedula_activa
  ON medicos (cedula_profesional) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_medicos_updated_at
  BEFORE UPDATE ON medicos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE medico_especialidades (
  medico_id        BIGINT   NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  especialidad_id  SMALLINT NOT NULL REFERENCES especialidades(id),
  PRIMARY KEY (medico_id, especialidad_id)
);

-- =====================================================================
-- CONSULTORIOS
-- =====================================================================

CREATE TABLE consultorios (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  direccion   VARCHAR(200),
  telefono    VARCHAR(20),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER trg_consultorios_updated_at
  BEFORE UPDATE ON consultorios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE medico_consultorios (
  medico_id       BIGINT NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  consultorio_id  BIGINT NOT NULL REFERENCES consultorios(id) ON DELETE CASCADE,
  PRIMARY KEY (medico_id, consultorio_id)
);

-- =====================================================================
-- HORARIOS (disponibilidad recurrente del médico por consultorio)
-- =====================================================================

-- Tipo de rango propio sobre TIME: PostgreSQL no trae uno nativo.
-- El constructor autogenerado por CREATE TYPE ... AS RANGE es IMMUTABLE
-- porque TIME nunca depende de la zona horaria de la sesión.
CREATE TYPE timerange AS RANGE (subtype = time);

CREATE TABLE horarios (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  medico_id       BIGINT   NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  consultorio_id  BIGINT   NOT NULL REFERENCES consultorios(id) ON DELETE CASCADE,
  dia_semana      SMALLINT NOT NULL,  -- ISO 8601: 1=lunes ... 7=domingo
  hora_inicio     TIME     NOT NULL,
  hora_fin        TIME     NOT NULL,
  activo          BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_horarios_dia_semana CHECK (dia_semana BETWEEN 1 AND 7),
  CONSTRAINT chk_horarios_rango CHECK (hora_fin > hora_inicio),

  CONSTRAINT ex_horarios_sin_traslape
    EXCLUDE USING gist (
      medico_id WITH =,
      dia_semana WITH =,
      timerange(hora_inicio, hora_fin) WITH &&
    ) WHERE (activo)
);

CREATE INDEX ix_horarios_medico ON horarios (medico_id) WHERE activo;
CREATE INDEX ix_horarios_consultorio ON horarios (consultorio_id) WHERE activo;

CREATE TRIGGER trg_horarios_updated_at
  BEFORE UPDATE ON horarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- CITAS
-- =====================================================================

CREATE TABLE citas (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid_publico     UUID NOT NULL DEFAULT gen_random_uuid(),
  paciente_id      BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  medico_id        BIGINT NOT NULL REFERENCES medicos(id)   ON DELETE CASCADE,
  consultorio_id   BIGINT NOT NULL REFERENCES consultorios(id),
  fecha_hora       TIMESTAMPTZ NOT NULL,
  duracion_minutos SMALLINT NOT NULL DEFAULT 30,
  fecha_fin        TIMESTAMPTZ NOT NULL,  -- calculada por trigger, ver trg_citas_fecha_fin
  estado_id        SMALLINT NOT NULL REFERENCES estados_cita(id) DEFAULT 1,
  motivo           TEXT,
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_citas_duracion CHECK (duracion_minutos BETWEEN 10 AND 240),
  CONSTRAINT chk_citas_fecha_futura_al_crear
    CHECK (fecha_hora > created_at - INTERVAL '1 minute'),

  -- timestamptz + interval es STABLE, no IMMUTABLE (depende de la zona horaria
  -- de la sesión para resolver meses/días con DST), así que NO puede ir dentro
  -- del índice. Por eso fecha_fin se calcula antes, con un trigger, y aquí el
  -- EXCLUDE solo referencia columnas ya resueltas: eso sí es inmutable.
  CONSTRAINT ex_citas_sin_traslape_medico
    EXCLUDE USING gist (
      medico_id WITH =,
      tstzrange(fecha_hora, fecha_fin) WITH &&
    ) WHERE (estado_id IN (1, 2, 3))  -- pendiente, confirmada, reagendada
);

CREATE UNIQUE INDEX ux_citas_uuid ON citas (uuid_publico);
CREATE INDEX ix_citas_paciente ON citas (paciente_id);
CREATE INDEX ix_citas_medico_fecha ON citas (medico_id, fecha_hora);
CREATE INDEX ix_citas_estado ON citas (estado_id);
CREATE INDEX ix_citas_fecha_hora ON citas (fecha_hora);

CREATE TRIGGER trg_citas_updated_at
  BEFORE UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Calcula fecha_fin = fecha_hora + duracion_minutos ANTES de insertar/actualizar.
-- Los triggers sí pueden hacer esta aritmética (no están sujetos a IMMUTABLE);
-- el resultado queda como columna normal que el EXCLUDE de arriba puede usar.
CREATE OR REPLACE FUNCTION calcular_fecha_fin_cita()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_fin := NEW.fecha_hora + (NEW.duracion_minutos * interval '1 minute');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_citas_fecha_fin
  BEFORE INSERT OR UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION calcular_fecha_fin_cita();

-- ---------------------------------------------------------------------
-- HISTORIAL DE ESTADOS DE CITA (auditoría — nunca se sobrescribe, se anexa)
-- ---------------------------------------------------------------------
CREATE TABLE historial_estados_cita (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cita_id         BIGINT NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  estado_anterior SMALLINT REFERENCES estados_cita(id),
  estado_nuevo    SMALLINT NOT NULL REFERENCES estados_cita(id),
  cambiado_por    BIGINT REFERENCES usuarios(id),
  origen          VARCHAR(30) NOT NULL DEFAULT 'web',
  comentario      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_historial_cita ON historial_estados_cita (cita_id, created_at);

CREATE OR REPLACE FUNCTION registrar_cambio_estado_cita()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    INSERT INTO historial_estados_cita (cita_id, estado_anterior, estado_nuevo, origen)
    VALUES (NEW.id, OLD.estado_id, NEW.estado_id, 'sistema');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_citas_historial
  AFTER UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION registrar_cambio_estado_cita();

-- =====================================================================
-- RECORDATORIOS (enviados por n8n vía Telegram)
-- =====================================================================

CREATE TABLE recordatorios (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cita_id     BIGINT NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  canal       VARCHAR(20) NOT NULL DEFAULT 'telegram',
  tipo        VARCHAR(30) NOT NULL,
  estado      VARCHAR(20) NOT NULL DEFAULT 'enviado',
  respuesta   VARCHAR(20),
  enviado_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_at TIMESTAMPTZ
);

CREATE INDEX ix_recordatorios_cita ON recordatorios (cita_id);
CREATE INDEX ix_recordatorios_estado ON recordatorios (estado);

-- =====================================================================
-- VISTA DE CONVENIENCIA: citas con nombres legibles (para dashboards)
-- =====================================================================
CREATE OR REPLACE VIEW vw_citas_detalle AS
SELECT
  c.id,
  c.uuid_publico,
  c.fecha_hora,
  c.duracion_minutos,
  ec.clave            AS estado,
  up.nombre           AS paciente_nombre,
  um.nombre           AS medico_nombre,
  co.nombre           AS consultorio_nombre,
  c.motivo,
  c.created_at
FROM citas c
JOIN pacientes p     ON p.id = c.paciente_id
JOIN usuarios up     ON up.id = p.usuario_id
JOIN medicos m       ON m.id = c.medico_id
JOIN usuarios um     ON um.id = m.usuario_id
JOIN consultorios co ON co.id = c.consultorio_id
JOIN estados_cita ec ON ec.id = c.estado_id;

COMMIT;

-- =====================================================================
-- SEED mínimo para desarrollo (admin inicial)
-- Genera el hash real con bcrypt desde Node antes de insertar en producción.
-- =====================================================================
-- INSERT INTO public.usuarios (nombre, email, password_hash, rol_id, estado_id)
-- VALUES ('Admin', 'admin@clinica.com', '<hash_bcrypt>', 1, 2);