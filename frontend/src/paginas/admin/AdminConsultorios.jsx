import { useState, useEffect, useCallback } from 'react';
import {
  faPlus, faEdit, faTrash, faEye, faToggleOn, faToggleOff,
} from '@fortawesome/free-solid-svg-icons';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiFetch, obtenerToken } from '../../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// ── Helpers ──────────────────────────────────────────────────────────────────

// El backend guarda solo los dígitos. Se agrupan para mostrarlos legibles.
function formatTelefono(telefono) {
  if (!telefono) return null;
  const d = String(telefono).replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Misma regla que el backend: solo dígitos, entre 7 y 15.
function validarTelefono(valor) {
  const d = String(valor ?? '').replace(/[\s\-()]/g, '');
  if (d === '') return null;
  if (!/^[0-9]{7,15}$/.test(d)) return 'El teléfono debe tener entre 7 y 15 dígitos';
  return null;
}

// Traduce el mensaje del backend al campo del formulario correspondiente.
function mapearError(err) {
  const mensaje = err.message || 'Error desconocido';
  if (err.status === 409) return { nombre: mensaje };
  if (err.status === 400) {
    const m = mensaje.toLowerCase();
    if (m.includes('tel')) return { telefono: mensaje };
    if (m.includes('direc')) return { direccion: mensaje };
    if (m.includes('nombre')) return { nombre: mensaje };
    return { form: mensaje };
  }
  return null;
}

// ── Columnas ─────────────────────────────────────────────────────────────────
const columnas = [
  { clave: 'nombre', titulo: 'Nombre' },
  {
    clave: 'direccion',
    titulo: 'Dirección',
    render: (fila) =>
      fila.direccion ? (
        <span className="celda-truncada" title={fila.direccion}>{fila.direccion}</span>
      ) : (
        <span className="celda-vacia">—</span>
      ),
  },
  {
    clave: 'telefono',
    titulo: 'Teléfono',
    render: (fila) => {
      const tel = formatTelefono(fila.telefono);
      return tel
        ? <span className="celda-telefono">{tel}</span>
        : <span className="celda-vacia">—</span>;
    },
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

const camposForm = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, placeholder: 'Ej. Consultorio Central' },
  { nombre: 'direccion', etiqueta: 'Dirección', tipo: 'text', requerido: true, placeholder: 'Ej. Av. Principal 123' },
  {
    nombre: 'telefono', etiqueta: 'Teléfono (opcional)', tipo: 'text', requerido: false,
    placeholder: 'Ej. 961 123 4567',
    ayuda: 'Entre 7 y 15 dígitos. Se guardan solo los dígitos.',
  },
];

// ── Componente principal ─────────────────────────────────────────────────────
export default function AdminConsultorios() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [confirmacion, setConfirmacion] = useState(null);
  const [toast, setToast] = useState(null);
  const [soloLectura, setSoloLectura] = useState(false);

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const token = obtenerToken();
      const params = new URLSearchParams();
      if (mostrarInactivos) params.append('todos', 'true');
      if (busqueda.trim()) params.append('q', busqueda.trim());
      const query = params.toString();
      const data = await apiFetch(`/api/consultorios${query ? `?${query}` : ''}`, { token });
      setDatos(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [mostrarInactivos, busqueda]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  function mostrarToast(mensaje, tipo = 'exito') {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Apertura de modales ────────────────────────────────────────────────────
  function abrirNueva() {
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

    const errorTelefono = validarTelefono(valores.telefono);
    if (errorTelefono) {
      setErrores({ telefono: errorTelefono });
      return;
    }

    setGuardando(true);
    try {
      const token = obtenerToken();
      const cuerpo = {
        nombre: valores.nombre,
        direccion: valores.direccion,
        telefono: valores.telefono || '',
      };

      if (editando) {
        await apiFetch(`/api/consultorios/${editando.id}`, { method: 'PUT', body: cuerpo, token });
        mostrarToast('Consultorio actualizado correctamente');
      } else {
        await apiFetch('/api/consultorios', { method: 'POST', body: cuerpo, token });
        mostrarToast('Consultorio creado correctamente');
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

  // ── Confirmaciones ────────────────────────────────────────────────────────
  function pedirConfirmacion(fila, accion) {
    setConfirmacion({ fila, accion });
  }

  async function handleCambiarEstado() {
    if (!confirmacion) return;
    const { fila } = confirmacion;
    setConfirmacion(null);
    try {
      const token = obtenerToken();
      await apiFetch(`/api/consultorios/${fila.id}/estado`, {
        method: 'PATCH',
        body: { activo: !fila.activo },
        token,
      });
      mostrarToast(fila.activo ? 'Consultorio desactivado' : 'Consultorio activado');
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
      const token = obtenerToken();
      await apiFetch(`/api/consultorios/${fila.id}`, { method: 'DELETE', token });
      mostrarToast('Consultorio eliminado correctamente');
      cargarDatos();
    } catch (err) {
      // 409 → "El consultorio tiene citas pendientes"
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

  // ── Vista "Ver consultorio" (solo lectura) ────────────────────────────────
  function renderVerConsultorio() {
    if (!editando) return null;
    const c = editando;
    const tel = formatTelefono(c.telefono);
    return (
      <dl className="ver-usuario-lista">
        <div className="ver-usuario-fila">
          <dt>Nombre</dt>
          <dd>{c.nombre}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Dirección</dt>
          <dd>{c.direccion || <span className="celda-vacia">—</span>}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Teléfono</dt>
          <dd>{tel || <span className="celda-vacia">—</span>}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Estado</dt>
          <dd>
            <span className={`badge ${c.activo ? 'badge-exito' : 'badge-inactivo'}`}>
              {c.activo ? 'Activo' : 'Inactivo'}
            </span>
          </dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Fecha de creación</dt>
          <dd>{formatFecha(c.created_at)}</dd>
        </div>
      </dl>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const esEliminar = confirmacion?.accion === 'eliminar';
  const esActivar = confirmacion?.accion === 'activar';

  return (
    <div className="admin-consultorios">
      <div className="filtros-barra">
        <h2>Consultorios</h2>

        <div className="filtros-controles">
          <input
            type="text"
            className="input"
            placeholder="Buscar por nombre o dirección…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <label className="form-checkbox-label">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
            />
            <span>Mostrar inactivos</span>
          </label>
          <div className="btn-nuevo-container-consultorio">
            <button className="btn btn-primario" onClick={abrirNueva}>
              <FontAwesomeIcon icon={faPlus} />
              <span>Nuevo consultorio</span>
            </button>
          </div>
        </div>
      </div>

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="No hay consultorios registrados"
        buscar={false}
      />

      {modalAbierto && (
        <FormModal
          titulo={editando ? (soloLectura ? 'Ver consultorio' : 'Editar consultorio') : 'Nuevo consultorio'}
          campos={camposForm}
          valoresIniciales={editando ? {
            nombre: editando.nombre,
            direccion: editando.direccion || '',
            telefono: editando.telefono || '',
          } : {}}
          onSubmit={handleSubmit}
          onCerrar={cerrarModal}
          errores={errores}
          guardando={guardando}
          soloLectura={soloLectura}
          renderVerUsuario={soloLectura && editando ? renderVerConsultorio : undefined}
        />
      )}

      {confirmacion && (
        <ConfirmDialog
          titulo={
            esEliminar ? 'Eliminar consultorio' :
            esActivar ? 'Activar consultorio' : 'Desactivar consultorio'
          }
          mensaje={
            esEliminar
              ? `¿Eliminar el consultorio "${confirmacion.fila.nombre}"? Se ocultará del sistema pero se conservará el historial de citas.`
              : esActivar
              ? `¿Activar el consultorio "${confirmacion.fila.nombre}"?`
              : `¿Desactivar el consultorio "${confirmacion.fila.nombre}"? Dejará de ofrecerse para nuevas citas.`
          }
          textoConfirmar={
            esEliminar ? 'Eliminar' : esActivar ? 'Activar' : 'Desactivar'
          }
          enConfirmacion={false}
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
