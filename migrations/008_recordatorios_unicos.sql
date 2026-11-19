-- RN-105: no debe existir más de un recordatorio del mismo tipo por cita,
-- incluso si dos procesos intentan enviarlo al mismo tiempo.
CREATE UNIQUE INDEX IF NOT EXISTS ux_recordatorios_cita_tipo
  ON recordatorios (cita_id, tipo);
