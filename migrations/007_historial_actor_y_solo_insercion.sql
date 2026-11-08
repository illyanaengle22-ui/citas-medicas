-- RN-091: el historial debe guardar quién cambió el estado y desde qué origen.
-- El adaptador PostgresCitaRepository establece estas variables locales antes
-- de actualizar la cita, dentro de la misma transacción.
CREATE OR REPLACE FUNCTION registrar_cambio_estado_cita()
RETURNS TRIGGER AS $$
DECLARE
  v_actor      BIGINT;
  v_origen     VARCHAR(30);
  v_comentario TEXT;
BEGIN
  IF NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    v_actor      := NULLIF(current_setting('app.cambiado_por', true), '')::BIGINT;
    v_origen     := COALESCE(NULLIF(current_setting('app.origen', true), ''), 'sistema');
    v_comentario := NULLIF(current_setting('app.comentario', true), '');

    INSERT INTO historial_estados_cita
      (cita_id, estado_anterior, estado_nuevo, cambiado_por, origen, comentario)
    VALUES
      (NEW.id, OLD.estado_id, NEW.estado_id, v_actor, v_origen, v_comentario);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RN-092: el historial es de solo inserción. Se impide modificarlo o borrarlo
-- incluso desde SQL directo. (El borrado físico de una cita también queda
-- bloqueado por el ON DELETE CASCADE, que es el comportamiento deseado.)
CREATE OR REPLACE FUNCTION impedir_modificacion_historial()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'El historial de estados es de solo inserción [RN-092]';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_historial_solo_insercion ON historial_estados_cita;
CREATE TRIGGER trg_historial_solo_insercion
  BEFORE UPDATE OR DELETE ON historial_estados_cita
  FOR EACH ROW EXECUTE FUNCTION impedir_modificacion_historial();
