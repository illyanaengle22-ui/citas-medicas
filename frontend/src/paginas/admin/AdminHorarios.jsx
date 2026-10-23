import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  faPlus, faEdit, faTrash, faEye, faToggleOn, faToggleOff,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiFetch } from '../../services/api';
import {
  DIAS_SEMANA, horaCorta, formatearFecha,
} from '../../components/citasHelpers';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Traduce el mensaje del backend (RN-060 a RN-065) al campo del formulario.
function mapearError(err) {
  const mensaje = err.message || 'Error desconocido';
  const m = mensaje.toLowerCase();
  if (m.includes('traslap') || m.includes('traslapan')) return { form: mensaje };
  if (m.includes('consultorio')) return { consultorio_id: mensaje };
  if (m.includes('dia_semana') || m.includes('día de la semana')) return { dia_semana: mensaje };
  if (m.includes('hora')) return { hora_fin: mensaje };
  if (err.status === 400 || err.status === 409) return { form: mensaje };
  return null;
}

function nombreDia(valor) {
  return DIAS_SEMANA.find((d) => d.valor === Number(valor))?.etiqueta ?? '—';
}

const opcionesDia = DIAS_SEMANA.map((d) => ({ valor: String(d.valor), etiqueta: d.etiqueta }));

// ── Columnas ─────────────────────────────────────────────────────────────────
const columnas = [
  { clave: 'medico_nombre', titulo: 'Médico' },
  { clave: 'consultorio_nombre', titulo: 'Consultorio' },
  {
    clave: 'dia_semana',
    titulo: 'Día',
    render: (fila) => nombreDia(fila.dia_semana),
  },
  {
    clave: 'hora_inicio',
    titulo: 'Horario',
    render: (fila) => `${horaCorta(fila.hora_inicio)} – ${horaCorta(fila.hora_fin)}`,
  },
  {
    clave: 'activo',
    titulo: 'Estado',
    render: (fila) => (
      <span className={`badge ${fila.activo ? 'badge-exito' : 'badge-inactivo'}`}>
        {fila.activo ? 'Activo' : 'Inactivo'}
      </span>
    ),
  },
];

// ── Componente principal ─────────────────────────────────────────────────────
export default function AdminHorarios() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [medicos, setMedicos] = useState([]);
  const [consultorios, setConsultorios] = useState([]);
  const [filtroMedico, setFiltroMedico] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [confirmacion, setConfirmacion] = useState(null);
  const [toast, setToast] = useState(null);
  const [soloLectura, setSoloLectura] = useState(false);

  // ── Catálogos (médicos y consultorios para los selects) ────────────────────
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [m, c] = await Promise.all([
          apiFetch('/api/medicos'),
          apiFetch('/api/consultorios'),
        ]);
        if (!vivo) return;
        setMedicos(Array.isArray(m) ? m : (m?.data ?? []));
        setConsultorios(Array.isArray(c) ? c : (c?.data ?? []));
      } catch {
        // Los catálogos son auxiliares; el listado principal avisa si falla.
      }
    })();
    return () => { vivo = false; };
  }, []);

  // ── Carga del listado ──────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (mostrarInactivos) params.append('todos', 'true');
      if (filtroMedico) params.append('medico', filtroMedico);
      const query = params.toString();
      const data = await apiFetch(`/api/horarios${query ? `?${query}` : ''}`);
      setDatos(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [mostrarInactivos, filtroMedico]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function mostrarToast(mensaje, tipo = 'exito') {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Modales ────────────────────────────────────────────────────────────────
  function abrirNuevo() {
    setEditando(null);
    setSoloLectura(false);
    setErrores({});
    setModalAbierto(true);
  }

  function abrirEditar(fila) {
    setEditando(fila);
    setSoloLectura(false);
    setErrores({});
    setModalAbierto(true);
  }

  function abrirVer(fila) {
    setEditando(fila);
    setSoloLectura(true);
    setErrores({});
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setSoloLectura(false);
    setEditando(null);
    setErrores({});
  }

  // ── Guardar (crear / editar) ───────────────────────────────────────────────
  async function handleSubmit(valores) {
    setErrores({});

    const cuerpo = {
      medico_id: valores.medico_id,
      consultorio_id: valores.consultorio_id,
      dia_semana: Number(valores.dia_semana),
      hora_inicio: valores.hora_inicio,
      hora_fin: valores.hora_fin,
    };

    if (!cuerpo.medico_id) return setErrores({ medico_id: 'Selecciona un médico' });
    if (!cuerpo.consultorio_id) return setErrores({ consultorio_id: 'Selecciona un consultorio' });

    setGuardando(true);
    try {
      if (editando) {
        await apiFetch(`/api/horarios/${editando.id}`, { method: 'PUT', body: cuerpo });
        mostrarToast('Horario actualizado correctamente');
      } else {
        await apiFetch('/api/horarios', { method: 'POST', body: cuerpo });
        mostrarToast('Horario registrado correctamente');
      }
      cerrarModal();
      cargarDatos();
    } catch (err) {
      const erroresCampo = mapearError(err);
      if (erroresCampo) setErrores(erroresCampo);
      else mostrarToast(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  // ── Activar / desactivar / eliminar (todo es borrado lógico, RN-064) ──────
  function pedirConfirmacion(fila, accion) {
    setConfirmacion({ fila, accion });
  }

  async function handleCambiarEstado() {
    if (!confirmacion) return;
    const { fila } = confirmacion;
    setConfirmacion(null);
    try {
      await apiFetch(`/api/horarios/${fila.id}/estado`, {
        method: 'PATCH',
        body: { activo: !fila.activo },
      });
      mostrarToast(fila.activo ? 'Horario desactivado' : 'Horario activado');
      cargarDatos();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  }

  async function handleEliminar() {
    if (!confirmacion) return;
    const { fila } = confirmacion;
    setConfirmacion(null);
    try {
      await apiFetch(`/api/horarios/${fila.id}`, { method: 'DELETE' });
      mostrarToast('Horario desactivado correctamente');
      cargarDatos();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  }

  // ── Acciones por fila ─────────────────────────────────────────────────────
  const acciones = (fila) => [
    { icono: faEye, titulo: 'Ver', clase: 'btn-ver', onClick: () => abrirVer(fila) },
    { icono: faEdit, titulo: 'Editar', clase: 'btn-editar', onClick: () => abrirEditar(fila) },
    fila.activo
      ? { icono: faToggleOff, titulo: 'Desactivar', clase: 'btn-rechazar', onClick: () => pedirConfirmacion(fila, 'desactivar') }
      : { icono: faToggleOn, titulo: 'Activar', clase: 'btn-aprobar', onClick: () => pedirConfirmacion(fila, 'activar') },
    { icono: faTrash, titulo: 'Eliminar', clase: 'btn-eliminar', onClick: () => pedirConfirmacion(fila, 'eliminar') },
  ];

  // ── Campos del formulario (cargados con los catálogos) ─────────────────────
  const camposForm = useMemo(() => [
    {
      nombre: 'medico_id', etiqueta: 'Médico', tipo: 'select', requerido: true,
      opciones: medicos.map((m) => ({ valor: String(m.id), etiqueta: m.medico_mostrar ?? m.nombre })),
      ayuda: 'El médico debe estar asignado al consultorio [RN-063].',
    },
    {
      nombre: 'consultorio_id', etiqueta: 'Consultorio', tipo: 'select', requerido: true,
      opciones: consultorios.map((c) => ({ valor: String(c.id), etiqueta: c.nombre })),
    },
    {
      nombre: 'dia_semana', etiqueta: 'Día de la semana', tipo: 'select', requerido: true,
      opciones: opcionesDia,
      ayuda: '1 = lunes … 7 = domingo [RN-060]',
    },
    {
      nombre: 'hora_inicio', etiqueta: 'Hora de inicio', tipo: 'time', requerido: true,
    },
    {
      nombre: 'hora_fin', etiqueta: 'Hora de fin', tipo: 'time', requerido: true,
      ayuda: 'Debe ser posterior a la hora de inicio [RN-061]',
    },
  ], [medicos, consultorios]);

  // ── Vista "Ver horario" ────────────────────────────────────────────────────
  function renderVerHorario() {
    if (!editando) return null;
    const h = editando;
    return (
      <dl className="ver-usuario-lista">
        <div className="ver-usuario-fila">
          <dt>Médico</dt>
          <dd>{h.medico_nombre ?? `#${h.medico_id}`}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Consultorio</dt>
          <dd>{h.consultorio_nombre ?? `#${h.consultorio_id}`}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Día</dt>
          <dd>{nombreDia(h.dia_semana)}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Horario</dt>
          <dd>{horaCorta(h.hora_inicio)} – {horaCorta(h.hora_fin)}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Estado</dt>
          <dd>
            <span className={`badge ${h.activo ? 'badge-exito' : 'badge-inactivo'}`}>
              {h.activo ? 'Activo' : 'Inactivo'}
            </span>
          </dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Creado</dt>
          <dd>{formatearFecha(h.created_at)}</dd>
        </div>
      </dl>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const esEliminar = confirmacion?.accion === 'eliminar';
  const esActivar = confirmacion?.accion === 'activar';
  const nombreFila = confirmacion
    ? `${confirmacion.fila.medico_nombre ?? ''} · ${nombreDia(confirmacion.fila.dia_semana)} ${horaCorta(confirmacion.fila.hora_inicio)}`
    : '';

  return (
    <div className="admin-horarios">
      <div className="filtros-barra">
        <h2>Horarios</h2>

        <div className="filtros-controles">
          <select
            className="input"
            value={filtroMedico}
            onChange={(e) => setFiltroMedico(e.target.value)}
          >
            <option value="">Todos los médicos</option>
            {medicos.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.medico_mostrar ?? m.nombre}</option>
            ))}
          </select>
          <label className="form-checkbox-label">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
            />
            <span>Mostrar inactivos</span>
          </label>
          <div className="btn-nuevo-container-consultorio">
            <button className="btn btn-primario" onClick={abrirNuevo}>
              <FontAwesomeIcon icon={faPlus} />
              <span>Nuevo horario</span>
            </button>
          </div>
        </div>
      </div>

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="No hay horarios registrados"
        buscar={false}
      />

      {modalAbierto && (
        <FormModal
          titulo={editando ? (soloLectura ? 'Ver horario' : 'Editar horario') : 'Nuevo horario'}
          campos={camposForm}
          valoresIniciales={editando ? {
            medico_id: String(editando.medico_id),
            consultorio_id: String(editando.consultorio_id),
            dia_semana: String(editando.dia_semana),
            hora_inicio: horaCorta(editando.hora_inicio),
            hora_fin: horaCorta(editando.hora_fin),
          } : {}}
          onSubmit={handleSubmit}
          onCerrar={cerrarModal}
          errores={errores}
          guardando={guardando}
          soloLectura={soloLectura}
          renderVerUsuario={soloLectura && editando ? renderVerHorario : undefined}
        />
      )}

      {confirmacion && (
        <ConfirmDialog
          titulo={
            esEliminar ? 'Eliminar horario' :
            esActivar ? 'Activar horario' : 'Desactivar horario'
          }
          mensaje={
            esEliminar
              ? `¿Eliminar el horario de ${nombreFila}? Se desactivará; las citas ya agendadas se conservan [RN-064].`
              : esActivar
              ? `¿Activar el horario de ${nombreFila}?`
              : `¿Desactivar el horario de ${nombreFila}? Dejará de ofrecerse para nuevas citas.`
          }
          textoConfirmar={esEliminar ? 'Eliminar' : esActivar ? 'Activar' : 'Desactivar'}
          onConfirmar={esEliminar ? handleEliminar : handleCambiarEstado}
          onCancelar={() => setConfirmacion(null)}
          tipo={esEliminar ? 'peligro' : 'primario'}
        />
      )}

      {toast && (
        <div className={`toast toast-${toast.tipo}`}>{toast.mensaje}</div>
      )}
    </div>
  );
}
