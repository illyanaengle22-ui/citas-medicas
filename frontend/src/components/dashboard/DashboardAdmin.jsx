import { useCallback, useEffect, useRef, useState } from 'react';
import {
  faBuilding,
  faCalendarDay,
  faClock,
  faRotateRight,
  faStethoscope,
  faUserInjured,
  faUserMd,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiFetch, obtenerToken } from '../../services/api';
import StatCard from './StatCard';
import UsuariosPorRolChart from './UsuariosPorRolChart';
import UsuariosPorEstadoChart from './UsuariosPorEstadoChart';
import RegistrosPorMesChart from './RegistrosPorMesChart';
import MedicosPorEspecialidadChart from './MedicosPorEspecialidadChart';
import MedicosPorConsultorioChart from './MedicosPorConsultorioChart';
import CitasPorEstadoChart from './CitasPorEstadoChart';
import CitasPorDiaChart from './CitasPorDiaChart';
import FiltroRango from './FiltroRango';
import { formatearRango, rangoDePreset } from './rangoFechas';
import { formatearHoraActualizacion } from './chartTheme';

function DashboardSkeleton() {
  return (
    <div className="dash-skeleton" role="status" aria-label="Cargando resumen del dashboard">
      <div className="dash-stats">
        {Array.from({ length: 7 }).map((_, indice) => (
          <div key={indice} className="dash-skeleton-stat" aria-hidden="true">
            <span className="dash-skeleton-bloque dash-skeleton-icono" />
            <span className="dash-skeleton-lineas">
              <span className="dash-skeleton-bloque dash-skeleton-valor" />
              <span className="dash-skeleton-bloque dash-skeleton-etiqueta" />
            </span>
          </div>
        ))}
      </div>
      <div className="dash-charts">
        {Array.from({ length: 4 }).map((_, indice) => (
          <div key={indice} className="dash-skeleton-grafica" aria-hidden="true">
            <span className="dash-skeleton-bloque dash-skeleton-titulo" />
            <span className="dash-skeleton-bloque dash-skeleton-cuerpo" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando...</span>
    </div>
  );
}

export default function DashboardAdmin() {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [actualizado, setActualizado] = useState(null);
  const [preset, setPreset] = useState('30d');
  const [rango, setRango] = useState(() => rangoDePreset('30d'));
  const solicitudRef = useRef(0);

  const rangoValido = Boolean(rango.inicio && rango.fin && rango.inicio <= rango.fin);

  const cargar = useCallback(async () => {
    const solicitud = solicitudRef.current + 1;
    solicitudRef.current = solicitud;

    if (!rangoValido) {
      setCargando(false);
      return;
    }

    setCargando(true);
    setError('');
    try {
      const token = obtenerToken();
      const params = new URLSearchParams({
        fecha_inicio: rango.inicio,
        fecha_fin: rango.fin,
      });
      const data = await apiFetch(`/api/dashboard/admin?${params.toString()}`, { token });
      if (solicitud !== solicitudRef.current) return;
      setResumen(data);
      setActualizado(new Date());
    } catch (err) {
      if (solicitud !== solicitudRef.current) return;
      setError(err.message || 'No se pudo cargar el resumen del dashboard.');
    } finally {
      if (solicitud === solicitudRef.current) setCargando(false);
    }
  }, [rango.inicio, rango.fin, rangoValido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function cambiarPreset(nuevoPreset) {
    setPreset(nuevoPreset);
    if (nuevoPreset !== 'personalizado') {
      setRango(rangoDePreset(nuevoPreset));
    }
  }

  const totales = resumen?.totales ?? {};
  const porcentajes = resumen?.porcentajes ?? {};
  const citasRango = totales.citasRango ?? 0;
  const duracionTexto = resumen?.duracionPromedioTexto ?? '—';
  const agrupacion = resumen?.rango?.agrupacionRegistros ?? 'dia';

  const tarjetas = [
    {
      icono: faUsers,
      etiqueta: 'Usuarios totales',
      valor: totales.usuarios ?? 0,
    },
    {
      icono: faClock,
      etiqueta: 'Pendientes de aprobación',
      valor: totales.pendientes ?? 0,
      to: '/admin/usuarios',
      aviso: (totales.pendientes ?? 0) > 0
        ? 'Hay cuentas por revisar'
        : 'Sin cuentas pendientes',
      destacada: (totales.pendientes ?? 0) > 0,
    },
    {
      icono: faUserMd,
      etiqueta: 'Médicos activos',
      valor: totales.medicosActivos ?? 0,
    },
    {
      icono: faUserInjured,
      etiqueta: 'Pacientes',
      valor: totales.pacientes ?? 0,
    },
    {
      icono: faBuilding,
      etiqueta: 'Consultorios activos',
      valor: totales.consultoriosActivos ?? 0,
    },
    {
      icono: faStethoscope,
      etiqueta: 'Especialidades activas',
      valor: totales.especialidadesActivas ?? 0,
    },
    {
      icono: faCalendarDay,
      etiqueta: preset === 'hoy' ? 'Citas de hoy' : 'Citas en el rango',
      valor: citasRango,
    },
  ];

  return (
    <div className="dash-admin" aria-busy={cargando}>
      <header className="dash-admin-cabecera">

        {/* ── Lado izquierdo: título + subtítulo + rango legible ── */}
        <div className="dash-admin-info">
          <h1 className="dash-admin-titulo">Dashboard</h1>
          <p className="dash-admin-subtitulo">
            Resumen general de usuarios, médicos y citas de la plataforma.
          </p>
          <p className="dash-rango-texto" aria-live="polite">
            {rangoValido
              ? `Mostrando datos del ${formatearRango(rango)}`
              : 'Selecciona una fecha inicial anterior o igual a la fecha final.'}
          </p>
        </div>

        {/* ── Lado derecho: acciones + filtros ── */}
        <div className="dash-admin-acciones">

          {/* Fila 1: "actualizado a las…" + botón Actualizar */}
          <div className="dash-admin-refresco">
            <span className="dash-admin-actualizado" aria-live="polite">
              {actualizado
                ? `Actualizado a las ${formatearHoraActualizacion(actualizado)}`
                : 'Cargando información...'}
            </span>
            <button
              type="button"
              className="dash-btn-actualizar"
              onClick={cargar}
              disabled={cargando || !rangoValido}
            >
              <FontAwesomeIcon
                icon={faRotateRight}
                className={cargando ? 'dash-icono-girando' : ''}
                aria-hidden="true"
              />
              {cargando ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          {/* Fila 2 (o misma fila si cabe): pill group + fechas personalizadas */}
          <FiltroRango
            preset={preset}
            rango={rango}
            onPreset={cambiarPreset}
            onRango={setRango}
          />
        </div>
      </header>

      {error && (
        <div className="dash-error" role="alert">
          <p>{error}</p>
          <button type="button" className="dash-btn-reintentar" onClick={cargar}>
            Reintentar
          </button>
        </div>
      )}

      {cargando && !resumen && <DashboardSkeleton />}

      {resumen && (
        <>
          <section aria-labelledby="dash-indicadores-titulo">
            <h2 id="dash-indicadores-titulo" className="sr-only">Indicadores generales</h2>
            <div className="dash-stats">
              {tarjetas.map((tarjeta) => (
                <StatCard key={tarjeta.etiqueta} {...tarjeta} />
              ))}
            </div>
          </section>

          <section aria-labelledby="dash-graficas-titulo">
            <h2 id="dash-graficas-titulo" className="dash-graficas-titulo">Gráficas del dashboard</h2>
            <div className="dash-charts">
              <UsuariosPorRolChart datos={resumen.usuariosPorRol ?? []} />
              <UsuariosPorEstadoChart
                datos={resumen.usuariosPorEstado ?? []}
                porcentajePendientes={porcentajes.cuentasPendientes}
              />
              <RegistrosPorMesChart
                datos={resumen.registrosPorMes ?? []}
                agrupacion={agrupacion}
              />
              <MedicosPorEspecialidadChart datos={resumen.medicosPorEspecialidad ?? []} />
              <MedicosPorConsultorioChart datos={resumen.medicosPorConsultorio ?? []} />
              <CitasPorEstadoChart
                datos={resumen.citasPorEstado ?? []}
                porcentajeConfirmadas={porcentajes.citasConfirmadas}
              />
              <CitasPorDiaChart
                datos={resumen.citasPorDia ?? []}
                descripcion={`${resumen.rango?.dias ?? 0} días · ${citasRango} citas en el rango · duración promedio: ${duracionTexto}`}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
