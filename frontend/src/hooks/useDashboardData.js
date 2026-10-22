import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, obtenerToken } from '../services/api';

/**
 * Carga el resumen de un dashboard y expone estados de carga, error y refresco.
 */
export default function useDashboardData(endpoint) {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [actualizado, setActualizado] = useState(null);
  const solicitudRef = useRef(0);

  const cargar = useCallback(async () => {
    const solicitud = solicitudRef.current + 1;
    solicitudRef.current = solicitud;

    setCargando(true);
    setError('');
    try {
      const respuesta = await apiFetch(endpoint, { token: obtenerToken() });
      if (solicitud !== solicitudRef.current) return;
      setData(respuesta);
      setActualizado(new Date());
    } catch (err) {
      if (solicitud !== solicitudRef.current) return;
      setError(err.message || 'No se pudo cargar la información del dashboard.');
    } finally {
      if (solicitud === solicitudRef.current) setCargando(false);
    }
  }, [endpoint]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { data, cargando, error, actualizado, recargar: cargar };
}
