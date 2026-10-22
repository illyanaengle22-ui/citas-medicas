import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarAlt,
  faCalendarDay,
  faChartColumn,
  faClock,
  faRotateRight,
  faUserInjured,
} from '@fortawesome/free-solid-svg-icons';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import useDashboardData from '../../hooks/useDashboardData';
import TarjetaStat from '../../components/dashboard/TarjetaStat';
import { formatearFechaCorta } from '../../components/dashboard/rangoFechas';
import {
  ESTILO_EJE,
  ESTILO_TOOLTIP,
  etiquetaCita,
  formatearHoraActualizacion,
  formatearNumero,
} from '../../components/dashboard/chartTheme';

function claseEstado(estado) {
  if (estado === 'confirmada' || estado === 'completada') return 'badge badge-exito';
  if (estado === 'cancelada' || estado === 'no_asistio') return 'badge badge-error';
  return 'badge badge-pendiente';
}

export default function DashboardMedico() {
  const { data, cargando, error, actualizado, recargar } = useDashboardData('/api/dashboard/medico');

  const totales = data?.totales ?? {};
  const proxima = data?.proximaCita ?? null;
  const agendaHoy = data?.agendaHoy ?? [];
  const citasSemana = data?.citasSemana ?? [];
  const totalSemana = citasSemana.reduce((total, dia) => total + Number(dia.total ?? 0), 0);
  const resumenSemana = citasSemana
    .map((dia) => `${dia.etiqueta}: ${formatearNumero(dia.total)}`)
    .join('; ');

  return (
    <div className="dash-admin" aria-busy={cargando}>
      <header className="dash-admin-cabecera">
        <div>
          <h1 className="dash-admin-titulo">Dashboard Médico</h1>
          <p className="dash-admin-subtitulo">
            Tu agenda, tus pacientes y la actividad de la semana.
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

      {cargando && !data && <p className="cargando">Cargando dashboard médico...</p>}

      {data && (
        <>
          <section aria-labelledby="medico-indicadores">
            <h2 id="medico-indicadores" className="sr-only">Indicadores del médico</h2>
            <div className="tarjetas-stats">
              <TarjetaStat
                icono={faCalendarDay}
                valor={totales.citasHoy ?? 0}
                etiqueta="Citas de hoy"
              />
              <TarjetaStat
                icono={faUserInjured}
                valor={totales.pacientesAtendidos ?? 0}
                etiqueta="Pacientes atendidos"
                detalle="Con al menos una cita completada"
              />
              <TarjetaStat
                icono={faClock}
                valor={proxima ? proxima.hora : '—'}
                etiqueta="Próxima cita"
                detalle={proxima
                  ? `${formatearFechaCorta(proxima.fecha)} · ${proxima.paciente}`
                  : 'Sin citas programadas'}
              />
            </div>
          </section>

          <section aria-labelledby="medico-agenda-titulo">
            <h2 id="medico-agenda-titulo" className="dash-graficas-titulo">
              Actividad del día y la semana
            </h2>
            <div className="paneles dashboard-paneles">
              <section className="panel" aria-labelledby="medico-agenda">
                <header className="panel-header">
                  <FontAwesomeIcon icon={faCalendarAlt} className="panel-icono" aria-hidden="true" />
                  <h2 id="medico-agenda">Mi agenda de hoy</h2>
                </header>

                {agendaHoy.length === 0 ? (
                  <p className="panel-vacio">No tienes citas agendadas para hoy.</p>
                ) : (
                  <div className="crud-table-scroll">
                    <table className="crud-table">
                      <thead>
                        <tr>
                          <th>Hora</th>
                          <th>Paciente</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agendaHoy.map((cita) => (
                          <tr key={cita.id}>
                            <td>{cita.hora}</td>
                            <td>{cita.paciente}</td>
                            <td>
                              <span className={claseEstado(cita.estado)}>
                                {etiquetaCita(cita.estado)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="panel" aria-labelledby="medico-semana">
                <header className="panel-header">
                  <FontAwesomeIcon icon={faChartColumn} className="panel-icono" aria-hidden="true" />
                  <h2 id="medico-semana">Citas de la semana</h2>
                </header>

                {totalSemana === 0 ? (
                  <p className="panel-vacio">Sin citas registradas esta semana.</p>
                ) : (
                  <div
                    className="panel-grafica"
                    role="img"
                    aria-label={`Citas de la semana. ${resumenSemana}`}
                  >
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={citasSemana} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF3" />
                        <XAxis
                          dataKey="etiqueta"
                          tick={ESTILO_EJE}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={ESTILO_EJE}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={ESTILO_TOOLTIP}
                          labelFormatter={(etiqueta, payload) => (
                            payload?.[0]?.payload?.fecha ?? etiqueta
                          )}
                          formatter={(valor) => [formatearNumero(valor), 'Citas']}
                        />
                        <Bar
                          dataKey="total"
                          name="Citas"
                          fill="#5E9BBA"
                          radius={[6, 6, 0, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
