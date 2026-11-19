-- RN-078: un paciente no puede tener dos citas vigentes traslapadas,
-- aunque sean con médicos distintos. El EXCLUDE del médico ya existía.
ALTER TABLE citas
  ADD CONSTRAINT ex_citas_sin_traslape_paciente
  EXCLUDE USING gist (
    paciente_id WITH =,
    tstzrange(fecha_hora, fecha_fin) WITH &&
  ) WHERE (estado_id IN (1, 2, 3));
