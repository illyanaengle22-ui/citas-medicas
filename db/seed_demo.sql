-- =====================================================================
-- SEED DE DEMOSTRACIÓN (Opcional - activado con CARGAR_DEMO=1)
-- =====================================================================

BEGIN;

-- 1. Especialidades médicas
INSERT INTO especialidades (nombre, descripcion, activo) VALUES
  ('Medicina General', 'Atención médica integral primaria y preventiva', true),
  ('Pediatría', 'Atención médica especializada para bebés, niños y adolescentes', true),
  ('Cardiología', 'Diagnóstico y tratamiento de enfermedades del corazón y sistema circulatorio', true),
  ('Dermatología', 'Cuidado y tratamiento de afecciones de la piel, cabello y uñas', true),
  ('Ginecología', 'Salud del sistema reproductor femenino y obstetricia', true)
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion, activo = true;

-- 2. Consultorios
INSERT INTO consultorios (nombre, direccion, telefono, activo) VALUES
  ('Consultorio 101 - General', 'Piso 1, Ala Norte', '555-0101', true),
  ('Consultorio 102 - Pediatría', 'Piso 1, Ala Sur', '555-0102', true),
  ('Consultorio 201 - Cardiología', 'Piso 2, Ala Norte', '555-0201', true),
  ('Consultorio 202 - Dermatología', 'Piso 2, Ala Sur', '555-0202', true)
ON CONFLICT DO NOTHING;

-- 3. Médicos de demostración (password: medico123)
-- Hash generado con crypt('medico123', gen_salt('bf', 10))
DO $$
DECLARE
  v_uid_m1 BIGINT;
  v_uid_m2 BIGINT;
  v_uid_m3 BIGINT;
  v_med_m1 BIGINT;
  v_med_m2 BIGINT;
  v_med_m3 BIGINT;
  v_esp_gen SMALLINT;
  v_esp_ped SMALLINT;
  v_esp_cardio SMALLINT;
  v_cons_101 BIGINT;
  v_cons_102 BIGINT;
  v_cons_201 BIGINT;
BEGIN
  SELECT id INTO v_esp_gen FROM especialidades WHERE nombre = 'Medicina General' LIMIT 1;
  SELECT id INTO v_esp_ped FROM especialidades WHERE nombre = 'Pediatría' LIMIT 1;
  SELECT id INTO v_esp_cardio FROM especialidades WHERE nombre = 'Cardiología' LIMIT 1;

  SELECT id INTO v_cons_101 FROM consultorios WHERE nombre LIKE 'Consultorio 101%' LIMIT 1;
  SELECT id INTO v_cons_102 FROM consultorios WHERE nombre LIKE 'Consultorio 102%' LIMIT 1;
  SELECT id INTO v_cons_201 FROM consultorios WHERE nombre LIKE 'Consultorio 201%' LIMIT 1;

  -- Médico 1: Dr. Roberto Hernández (Medicina General)
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'dr.hernandez@clinica.com') THEN
    INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
    VALUES ('Dr. Roberto Hernández', 'dr.hernandez@clinica.com', crypt('medico123', gen_salt('bf', 10)), 2, 2)
    RETURNING id INTO v_uid_m1;

    INSERT INTO medicos (usuario_id, cedula_profesional, telefono, activo)
    VALUES (v_uid_m1, 'CED-9874561', '555-1101', true)
    RETURNING id INTO v_med_m1;

    IF v_esp_gen IS NOT NULL THEN
      INSERT INTO medico_especialidades (medico_id, especialidad_id) VALUES (v_med_m1, v_esp_gen) ON CONFLICT DO NOTHING;
    END IF;

    IF v_cons_101 IS NOT NULL THEN
      INSERT INTO medico_consultorios (medico_id, consultorio_id) VALUES (v_med_m1, v_cons_101) ON CONFLICT DO NOTHING;
      -- Horarios Lunes a Viernes de 08:00 a 14:00
      INSERT INTO horarios (medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo)
      VALUES
        (v_med_m1, v_cons_101, 1, '08:00', '14:00', true),
        (v_med_m1, v_cons_101, 2, '08:00', '14:00', true),
        (v_med_m1, v_cons_101, 3, '08:00', '14:00', true),
        (v_med_m1, v_cons_101, 4, '08:00', '14:00', true),
        (v_med_m1, v_cons_101, 5, '08:00', '14:00', true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Médico 2: Dra. Carmen Morales (Pediatría)
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'dra.morales@clinica.com') THEN
    INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
    VALUES ('Dra. Carmen Morales', 'dra.morales@clinica.com', crypt('medico123', gen_salt('bf', 10)), 2, 2)
    RETURNING id INTO v_uid_m2;

    INSERT INTO medicos (usuario_id, cedula_profesional, telefono, activo)
    VALUES (v_uid_m2, 'CED-5432109', '555-1102', true)
    RETURNING id INTO v_med_m2;

    IF v_esp_ped IS NOT NULL THEN
      INSERT INTO medico_especialidades (medico_id, especialidad_id) VALUES (v_med_m2, v_esp_ped) ON CONFLICT DO NOTHING;
    END IF;

    IF v_cons_102 IS NOT NULL THEN
      INSERT INTO medico_consultorios (medico_id, consultorio_id) VALUES (v_med_m2, v_cons_102) ON CONFLICT DO NOTHING;
      -- Horarios Lunes a Viernes de 09:00 a 15:00
      INSERT INTO horarios (medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo)
      VALUES
        (v_med_m2, v_cons_102, 1, '09:00', '15:00', true),
        (v_med_m2, v_cons_102, 2, '09:00', '15:00', true),
        (v_med_m2, v_cons_102, 3, '09:00', '15:00', true),
        (v_med_m2, v_cons_102, 4, '09:00', '15:00', true),
        (v_med_m2, v_cons_102, 5, '09:00', '15:00', true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Médico 3: Dr. Alejandro Ruiz (Cardiología)
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'dr.ruiz@clinica.com') THEN
    INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
    VALUES ('Dr. Alejandro Ruiz', 'dr.ruiz@clinica.com', crypt('medico123', gen_salt('bf', 10)), 2, 2)
    RETURNING id INTO v_uid_m3;

    INSERT INTO medicos (usuario_id, cedula_profesional, telefono, activo)
    VALUES (v_uid_m3, 'CED-1122334', '555-1103', true)
    RETURNING id INTO v_med_m3;

    IF v_esp_cardio IS NOT NULL THEN
      INSERT INTO medico_especialidades (medico_id, especialidad_id) VALUES (v_med_m3, v_esp_cardio) ON CONFLICT DO NOTHING;
    END IF;

    IF v_cons_201 IS NOT NULL THEN
      INSERT INTO medico_consultorios (medico_id, consultorio_id) VALUES (v_med_m3, v_cons_201) ON CONFLICT DO NOTHING;
      -- Horarios Lunes, Miércoles y Viernes de 10:00 a 16:00
      INSERT INTO horarios (medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo)
      VALUES
        (v_med_m3, v_cons_201, 1, '10:00', '16:00', true),
        (v_med_m3, v_cons_201, 3, '10:00', '16:00', true),
        (v_med_m3, v_cons_201, 5, '10:00', '16:00', true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Paciente demo: Juan Pérez (password: paciente123)
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'paciente.demo@clinica.com') THEN
    DECLARE
      v_uid_pac BIGINT;
    BEGIN
      INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
      VALUES ('Juan Pérez', 'paciente.demo@clinica.com', crypt('paciente123', gen_salt('bf', 10)), 3, 2)
      RETURNING id INTO v_uid_pac;

      INSERT INTO pacientes (usuario_id, telefono, fecha_nacimiento)
      VALUES (v_uid_pac, '555-9000', '1995-05-15');
    END;
  END IF;
END $$;

COMMIT;
