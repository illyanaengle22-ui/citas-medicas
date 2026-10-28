import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarCheck,
  faCalendarDay,
  faCalendarPlus,
  faCircleCheck,
  faClipboardList,
  faRotateRight,
  faUserDoctor,
} from '@fortawesome/free-solid-svg-icons';
import useDashboardData from '../../hooks/useDashboardData';
import TarjetaStat from '../../components/dashboard/TarjetaStat';
import VincularTelegram from '../../components/VincularTelegram';
import { formatearFechaCorta } from '../../components/dashboard/rangoFechas';
import {
  etiquetaCita,
  formatearHoraActualizacion,
} from '../../components/dashboard/chartTheme';

function claseEstado(estado) {
  if (estado === 'confirmada' || estado === 'completada') return 'badge badge-exito';
  if (estado === 'cancelada' || estado === 'no_asistio') return 'badge badge-error';
  return 'badge badge-pendiente';
}

function AccionesCita() {
  return (
    <div className="dashboard-acciones-grandes">
      <Link className="btn btn-primario" to="/paciente/agendar">
        <FontAwesomeIcon icon={faCalendarPlus} aria-hidden="true" />
        Agendar nueva cita
      </Link>
      <Link className="btn btn-secundario" to="/paciente/historial">
        <FontAwesomeIcon icon={faClipboardList} aria-hidden="true" />
        Ver historial
      </Link>
    </div>
  );
}

export default function DashboardPaciente() {
  const { data, cargando, error, actualizado, recargar } = useDashboardData('/api/dashboard/paciente');

  const citasProgramadas = data?.citasProgramadas ?? data?.totales?.citasProgramadas ?? 0;
  const citasCompletadas = data?.citasCompletadas ?? data?.totales?.citasCompletadas ?? 0;
  const doctorPrincipal = data?.doctorPrincipal ?? null;
  const proxima = data?.proximaCita ?? null;
  const proximasCitas = data?.proximasCitas ?? [];

  return (
    <div className="dash-admin dashboard-paciente" aria-busy={cargando}>
      <header className="dash-admin-cabecera">
        <div>
          <h1 className="dash-admin-titulo">Dashboard Paciente</h1>
          <p className="dash-admin-subtitulo">
            Tus citas, tu historial y tu médico principal.
          </p>
        </div>
        <div className="dash-admin-acciones">
          <div className="dash-admin-refresco">
            <span className="dash-admin-actualizado" aria-live="polite">
              {actualizado
                ? `Actualizado a las ${formatearHoraActualizacion(actualizado)}`
                : 'Cargando información...'}
            </span>
            <button
              type="button"
              className="dash-btn-actualizar"
              onClick={recargar}
              disabled={cargando}
            >
              <FontAwesomeIcon
                icon={faRotateRight}
                className={cargando ? 'dash-icono-girando' : ''}
                aria-hidden="true"
              />
              {cargando ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="dash-error" role="alert">
          <p>{error}</p>
          <button type="button" className="dash-btn-reintentar" onClick={recargar}>
            Reintentar
          </button>
        </div>
      )}

      {cargando && !data && (
        <div className="crud-cargando" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Cargando dashboard paciente...</span>
        </div>
      )}

      {data && (
        <>
          <section aria-labelledby="paciente-indicadores">
            <h2 id="paciente-indicadores" className="sr-only">Indicadores del paciente</h2>
            <div className="tarjetas-stats">
              <TarjetaStat
                icono={faCalendarCheck}
                valor={citasProgramadas}
                etiqueta="Mis citas programadas"
              />
              <TarjetaStat
                icono={faCircleCheck}
                valor={citasCompletadas}
                etiqueta="Citas completadas"
              />
              <TarjetaStat
                icono={faUserDoctor}
                valor={doctorPrincipal?.medico ?? '—'}
                etiqueta="Mi doctor principal"
                detalle={doctorPrincipal
                  ? `${doctorPrincipal.especialidad ?? 'Medicina general'} · ${doctorPrincipal.total} cita(s)`
                  : 'Aún no tienes citas registradas'}
                compacto
              />
            </div>
          </section>

          <section aria-labelledby="paciente-citas-titulo">
            <h2 id="paciente-citas-titulo" className="dash-graficas-titulo">
              Mis citas
            </h2>

            {proxima ? (
              <div className="paneles dashboard-paneles">
                <section className="panel" aria-labelledby="paciente-proxima">
                  <header className="panel-header">
                    <FontAwesomeIcon icon={faCalendarDay} className="panel-icono" aria-hidden="true" />
                    <h2 id="paciente-proxima">Próxima cita</h2>
                  </header>

                  <div className="panel-cuerpo panel-proxima">
                    <div className="proxima-cabecera">
                      <div>
                        <p className="proxima-fecha">{formatearFechaCorta(proxima.fecha)}</p>
                        <p className="proxima-hora">{proxima.hora}</p>
                      </div>
                      <span className={claseEstado(proxima.estado)}>
                        {etiquetaCita(proxima.estado)}
                      </span>
                    </div>
                    <div>
                      <p className="panel-fila-principal">{proxima.medico}</p>
                      <p className="panel-fila-secundario">
                        {proxima.especialidad ?? 'Medicina general'} · {proxima.consultorio}
                      </p>
                    </div>
                    <AccionesCita />
                  </div>
                </section>

                <section className="panel" aria-labelledby="paciente-proximas">
                  <header className="panel-header">
                    <FontAwesomeIcon icon={faCalendarCheck} className="panel-icono" aria-hidden="true" />
                    <h2 id="paciente-proximas">Próximas citas</h2>
                  </header>

                  {proximasCitas.length <= 1 ? (
                    <div className="panel-vacio panel-vacio--compacto">
                      <FontAwesomeIcon
                        icon={faCalendarCheck}
                        className="panel-vacio-icono"
                        aria-hidden="true"
                      />
                      <p>No hay más citas próximas.</p>
                    </div>
                  ) : (
                    <div className="panel-lista">
                      {proximasCitas.slice(1).map((cita) => (
                        <div className="panel-fila" key={cita.id}>
                          <span className="avatar" aria-hidden="true">
                            <FontAwesomeIcon icon={faCalendarDay} />
                          </span>
                          <div className="panel-fila-info">
                            <span className="panel-fila-principal">{cita.medico}</span>
                            <span className="panel-fila-secundario">
                              {formatearFechaCorta(cita.fecha)} · {cita.hora} · {cita.especialidad ?? 'Medicina general'}
                            </span>
                          </div>
                          <span className={claseEstado(cita.estado)}>
                            {etiquetaCita(cita.estado)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <section className="panel panel-vacia-paciente" aria-labelledby="paciente-sin-citas">
                <div className="panel-vacia-paciente-contenido">
                  <span className="panel-vacia-paciente-icono" aria-hidden="true">
                    <FontAwesomeIcon icon={faCalendarDay} />
                  </span>
                  <div className="panel-vacia-paciente-texto">
                    <h3 id="paciente-sin-citas">Aún no tienes citas agendadas</h3>
                    <p>Agenda una nueva cita y aquí verás los detalles de tu próxima consulta.</p>
                  </div>
                  <AccionesCita />
                </div>
              </section>
            )}
          </section>

          <VincularTelegram />
        </>
      )}
    </div>
  );
}
