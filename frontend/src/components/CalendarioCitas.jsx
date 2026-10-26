import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import esLocale from '@fullcalendar/core/locales/es';
import './CalendarioCitas.css';

const COLORES_ESTADO = {
  pendiente: 'evento-pendiente',
  confirmada: 'evento-confirmada',
  reagendada: 'evento-reagendada',
  cancelada: 'evento-cancelada',
  completada: 'evento-completada',
  no_asistio: 'evento-no-asistio',
};

function calcularFin(cita) {
  if (cita.fecha_fin) return cita.fecha_fin;
  const inicio = new Date(cita.fecha_hora);
  if (Number.isNaN(inicio.getTime())) return undefined;
  const minutos = Number(cita.duracion_minutos) || 30;
  return new Date(inicio.getTime() + minutos * 60_000).toISOString();
}

function crearEventos(citas) {
  return (citas ?? []).flatMap((cita) => {
    if (!cita?.fecha_hora) return [];
    const inicio = new Date(cita.fecha_hora);
    if (Number.isNaN(inicio.getTime())) return [];

    const partesTitulo = [cita.paciente_nombre, cita.medico_nombre].filter(Boolean);
    const estado = cita.estado ?? 'pendiente';

    return [{
      id: String(cita.id),
      title: partesTitulo.length > 0 ? partesTitulo.join(' - ') : `Cita #${cita.id}`,
      start: cita.fecha_hora,
      end: calcularFin(cita),
      allDay: false,
      classNames: ['evento-cita', COLORES_ESTADO[estado] ?? 'evento-pendiente'],
      extendedProps: { cita },
    }];
  });
}

/**
 * Calendario reutilizable de citas.
 *
 * Props:
 *  - citas: array de citas con `fecha_hora`, `paciente_nombre`, `medico_nombre`, etc.
 *  - onEventClick: recibe la cita original al hacer clic en un evento.
 */
export default function CalendarioCitas({ citas = [], onEventClick }) {
  const eventos = useMemo(() => crearEventos(citas), [citas]);

  return (
    <section className="calendario-citas" aria-label="Calendario de citas">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="dayGridMonth"
        locale={esLocale}
        firstDay={1}
        height={720}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek',
        }}
        buttonText={{
          today: 'Hoy',
          month: 'Mes',
          week: 'Semana',
        }}
        dayMaxEvents={3}
        eventDisplay="block"
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotDuration="00:30:00"
        slotLabelInterval="01:00"
        scrollTime="08:00:00"
        allDaySlot={false}
        nowIndicator
        events={eventos}
        eventClick={(info) => {
          info.jsEvent?.preventDefault();
          onEventClick?.(info.event.extendedProps.cita);
        }}
        eventDidMount={(info) => {
          const cita = info.event.extendedProps.cita;
          if (!cita) return;
          info.el.title = [
            info.event.title,
            cita.fecha_hora ? new Date(cita.fecha_hora).toLocaleString('es-MX') : '',
            cita.estado ? `Estado: ${cita.estado}` : '',
            cita.consultorio_nombre ? `Consultorio: ${cita.consultorio_nombre}` : '',
          ].filter(Boolean).join('\n');
        }}
      />
    </section>
  );
}
