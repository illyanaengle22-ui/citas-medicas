import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  faEdit, faTrash, faEye, faCheck, faTimes,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiFetch, obtenerToken, obtenerUsuario } from '../../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// ── Catálogos ────────────────────────────────────────────────────────────────
// IMPORTANTE: los valores son STRINGS para que coincidan con lo que devuelve
// el backend (campo `rol` = clave string: 'admin' | 'medico' | 'paciente').
const ROLES = [
  { valor: 'admin',    etiqueta: 'Administrador' },
  { valor: 'medico',   etiqueta: 'Médico',        deshabilitado: true, ayuda: 'Se crea desde el módulo Médicos' },
  { valor: 'paciente', etiqueta: 'Paciente' },
];

const ESTADOS = [
  { valor: 'pendiente', etiqueta: 'Pendiente',  clase: 'badge-pendiente' },
  { valor: 'activo',    etiqueta: 'Activo',      clase: 'badge-exito'    },
  { valor: 'rechazado', etiqueta: 'Rechazado',   clase: 'badge-error'    },
];

// Mapa de clave string → rol_id numérico (para llamar a PUT /api/usuarios/:id/rol)
const ROL_CLAVE_A_ID = { admin: 1, medico: 2, paciente: 3 };

// ── Helpers ──────────────────────────────────────────────────────────────────
function iniciales(nombre) {
  return nombre.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function rolEtiqueta(clave) {
  const r = ROLES.find((x) => x.valor === clave);
  return r ? r.etiqueta : (clave || 'Desconocido');
}

function estadoEtiqueta(estado) {
  const e = ESTADOS.find((x) => x.valor === estado);
  return e ? e.etiqueta : estado;
}

function estadoClase(estado) {
  const e = ESTADOS.find((x) => x.valor === estado);
  return e ? e.clase : '';
}

function formatFecha(fecha) {
  if (!fecha) return 'Nunca';
  return new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Definición de columnas ───────────────────────────────────────────────────
const columnas = [
  {
    clave: 'nombre',
    titulo: 'Usuario',
    render: (fila) => (
      <div className="usuario-celda">
        <div className="avatar">{iniciales(fila.nombre)}</div>
        <span>{fila.nombre}</span>
      </div>
    ),
  },
  { clave: 'email', titulo: 'Email' },
  {
    clave: 'rol',
    titulo: 'Rol',
    render: (fila) => (
      <span className="badge badge-info">{rolEtiqueta(fila.rol)}</span>
    ),
  },
  {
    clave: 'estado',
    titulo: 'Estado',
    render: (fila) => (
      <span className={`badge ${estadoClase(fila.estado)}`}>{estadoEtiqueta(fila.estado)}</span>
    ),
  },
  {
    clave: 'ultimo_login',
    titulo: 'Último login',
    render: (fila) => formatFecha(fila.ultimo_login),
  },
];

// ── Campos de formulario ─────────────────────────────────────────────────────
// NOTA: los valores del select rol usan la CLAVE STRING del backend.
const camposFormCrear = [
  { nombre: 'nombre',   etiqueta: 'Nombre',      tipo: 'text',     requerido: true,  placeholder: 'Nombre completo' },
  { nombre: 'email',    etiqueta: 'Email',        tipo: 'email',    requerido: true,  placeholder: 'email@ejemplo.com' },
  {
    nombre: 'password', etiqueta: 'Contraseña',   tipo: 'password', requerido: true,
    placeholder: 'Mínimo 8 caracteres',
    ayuda: 'Mínimo 8 caracteres.',
  },
  {
    nombre: 'rol', etiqueta: 'Rol', tipo: 'select', requerido: true,
    placeholder: 'Selecciona un rol',
    opciones: ROLES.filter((r) => !r.deshabilitado).map((r) => ({ valor: r.valor, etiqueta: r.etiqueta })),
  },
];

const camposFormEditar = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text',  requerido: true },
  { nombre: 'email',  etiqueta: 'Email',  tipo: 'email', requerido: true },
  {
    nombre: 'password', etiqueta: 'Contraseña', tipo: 'password', requerido: false,
    placeholder: 'Déjala vacía para no cambiarla',
    ayuda: 'Mínimo 8 caracteres. Déjala vacía para no cambiarla.',
  },
  {
    nombre: 'rol', etiqueta: 'Rol', tipo: 'select', requerido: true,
    placeholder: 'Selecciona un rol',
    opciones: ROLES.filter((r) => !r.deshabilitado).map((r) => ({ valor: r.valor, etiqueta: r.etiqueta })),
  },
];

// ── Componente principal ─────────────────────────────────────────────────────
export default function AdminUsuarios() {
  const [pestana, setPestana] = useState('todos');
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [total, setTotal] = useState(0);
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [confirmacion, setConfirmacion] = useState(null);
  const [toast, setToast] = useState(null);
  const [soloLectura, setSoloLectura] = useState(false);
  const [stats, setStats] = useState({ pendientes: 0 });

  const usuarioActual = obtenerUsuario();

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const token = obtenerToken();
      let url;
      if (pestana === 'pendientes') {
        url = '/api/usuarios/pendientes';
      } else {
        const params = new URLSearchParams();
        if (filtroRol)    params.append('rol', filtroRol);
        if (filtroEstado) params.append('estado', filtroEstado);
        if (busqueda)     params.append('q', busqueda);
        params.append('page', pagina);
        params.append('limit', limite);
        url = `/api/usuarios?${params.toString()}`;
      }
      const data = await apiFetch(url, { token });
      if (pestana === 'pendientes') {
        setDatos(Array.isArray(data) ? data : (data.data ?? []));
      } else {
        setDatos(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [pestana, pagina, limite, filtroRol, filtroEstado, busqueda]);

  const cargarStats = useCallback(async () => {
    try {
      const token = obtenerToken();
      const data = await apiFetch('/api/usuarios/stats', { token });
      setStats(data);
    } catch (err) {
      console.error('Error cargando stats:', err);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    cargarStats();
  }, [cargarDatos, cargarStats]);

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
    setGuardando(true);
    setErrores({});
    try {
      const token = obtenerToken();
      const esCreacion = !editando;

      // Separar campo rol del resto
      const { rol: rolNuevo, password, ...restoValores } = valores;

      if (esCreacion) {
        // Crear: enviar nombre, email, password, rol_id en un solo POST
        const rolId = ROL_CLAVE_A_ID[rolNuevo];
        await apiFetch('/api/usuarios', {
          method: 'POST',
          body: {
            ...restoValores,
            password,
            rol_id: rolId,
          },
          token,
        });
        mostrarToast('Usuario creado correctamente');
      } else {
        // Editar: actualizar nombre/email/(password) con PUT /:id
        const cuerpo = { ...restoValores };
        if (password) cuerpo.password = password;

        await apiFetch(`/api/usuarios/${editando.id}`, {
          method: 'PUT',
          body: cuerpo,
          token,
        });

        // Llamar a PUT /:id/rol SOLO si el rol cambió
        const rolOriginal = editando.rol; // clave string del backend
        if (rolNuevo && rolNuevo !== rolOriginal) {
          const rolId = ROL_CLAVE_A_ID[rolNuevo];
          await apiFetch(`/api/usuarios/${editando.id}/rol`, {
            method: 'PUT',
            body: { rol_id: rolId },
            token,
          });
        }

        mostrarToast('Usuario actualizado correctamente');
      }

      cerrarModal();
      cargarDatos();
      cargarStats();
    } catch (err) {
      if (err.status === 409) {
        setErrores({ email: err.message });
      } else if (err.status === 400) {
        setErrores({ form: err.message });
      } else {
        mostrarToast(err.message, 'error');
      }
    } finally {
      setGuardando(false);
    }
  }

  // ── Confirmaciones ────────────────────────────────────────────────────────
  function pedirConfirmacion(fila, accion) {
    setConfirmacion({ fila, accion });
  }

  async function handleAccionPendiente() {
    if (!confirmacion) return;
    const { fila, accion } = confirmacion;
    setConfirmacion(null);
    try {
      const token = obtenerToken();
      const endpoint = accion === 'aprobar'
        ? `/api/usuarios/${fila.id}/aprobar`
        : `/api/usuarios/${fila.id}/negar`;
      const method = accion === 'aprobar' ? 'PUT' : 'DELETE';
      await apiFetch(endpoint, { method, token });
      mostrarToast(accion === 'aprobar' ? 'Usuario aprobado correctamente' : 'Cuenta rechazada correctamente');
      cargarDatos();
      cargarStats();
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
      await apiFetch(`/api/usuarios/${fila.id}`, { method: 'DELETE', token });
      mostrarToast('Usuario eliminado correctamente');
      cargarDatos();
      cargarStats();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  }

  // ── Acciones por fila ─────────────────────────────────────────────────────
  const esAdminActual = (fila) => fila.id === usuarioActual?.id;

  const acciones = (fila) => [
    { icono: faEye,   titulo: 'Ver',    onClick: () => abrirVer(fila) },
    { icono: faEdit,  titulo: 'Editar', onClick: () => abrirEditar(fila) },
    ...(fila.estado === 'pendiente' ? [
      { icono: faCheck, titulo: 'Aprobar',  clase: 'btn-exito', onClick: () => pedirConfirmacion(fila, 'aprobar')  },
      { icono: faTimes, titulo: 'Rechazar', clase: 'btn-error', onClick: () => pedirConfirmacion(fila, 'rechazar') },
    ] : []),
    ...(!esAdminActual(fila) ? [{
      icono: faTrash, titulo: 'Eliminar', clase: 'btn-error',
      onClick: () => pedirConfirmacion(fila, 'eliminar'),
    }] : []),
  ];

  // ── Filtrado local ────────────────────────────────────────────────────────
  const datosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return datos;
    const t = busqueda.toLowerCase();
    return datos.filter((f) =>
      f.nombre.toLowerCase().includes(t) || f.email.toLowerCase().includes(t)
    );
  }, [datos, busqueda]);

  // ── Valores iniciales para el modal editar ─────────────────────────────────
  // rol_id del backend se devuelve como CLAVE STRING (admin, paciente, medico).
  const valoresEditar = editando
    ? {
        nombre:   editando.nombre,
        email:    editando.email,
        password: '',
        rol:      editando.rol, // clave string: 'admin' | 'paciente' | 'medico'
      }
    : {};

  // ── Vista "Ver usuario" (solo lectura con badges) ────────────────────────
  function renderVerUsuario() {
    if (!editando) return null;
    const u = editando;
    const rolClase =
      u.rol === 'admin'    ? 'badge-admin'    :
      u.rol === 'medico'   ? 'badge-medico'   :
      u.rol === 'paciente' ? 'badge-paciente' : 'badge-info';

    return (
      <dl className="ver-usuario-lista">
        <div className="ver-usuario-fila">
          <dt>Nombre</dt>
          <dd>{u.nombre}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Email</dt>
          <dd>{u.email}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Rol</dt>
          <dd>
            <span className={`badge ${rolClase}`}>{rolEtiqueta(u.rol)}</span>
          </dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Estado</dt>
          <dd>
            <span className={`badge ${estadoClase(u.estado)}`}>{estadoEtiqueta(u.estado)}</span>
          </dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Fecha de creación</dt>
          <dd>{formatFecha(u.created_at)}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Último login</dt>
          <dd>{formatFecha(u.ultimo_login)}</dd>
        </div>
        {u.uuid_publico && (
          <div className="ver-usuario-fila">
            <dt>UUID público</dt>
            <dd className="ver-usuario-uuid">{u.uuid_publico}</dd>
          </div>
        )}
      </dl>
    );
  }

  // ── Pestañas ──────────────────────────────────────────────────────────────
  const pestanas = [
    { id: 'todos',     etiqueta: `Todos${stats.pendientes > 0 ? ` (${stats.pendientes} pendientes)` : ''}` },
    { id: 'pendientes', etiqueta: `Pendientes${stats.pendientes > 0 ? ` (${stats.pendientes})` : ''}` },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="admin-usuarios">
      {/* Barra superior */}
      <div className="filtros-barra">
        <h2>Usuarios</h2>

        <div className="pestanas-bar">
          {pestanas.map((p) => (
            <button
              key={p.id}
              className={`btn ${pestana === p.id ? 'btn-primario' : 'btn-secundario'}`}
              onClick={() => { setPestana(p.id); setPagina(1); }}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        <div className="filtros-controles">
          <input
            type="text"
            className="input"
            placeholder="Buscar por nombre o email…"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          />
          <select
            className="input"
            value={filtroRol}
            onChange={(e) => { setFiltroRol(e.target.value); setPagina(1); }}
          >
            <option value="">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="medico">Médico</option>
            <option value="paciente">Paciente</option>
          </select>
          <select
            className="input"
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="activo">Activo</option>
            <option value="rechazado">Rechazado</option>
          </select>

          <div className="btn-nuevo-container">
            {pestana === 'todos' && (
              <button className="btn btn-primario" onClick={abrirNueva}>
                <FontAwesomeIcon icon={faUserPlus} />
                <span>Nuevo usuario</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <CrudTable
        columnas={columnas}
        datos={pestana === 'pendientes' ? datos : datosFiltrados}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="No hay usuarios registrados"
        buscar={false}
      />

      {/* Paginación */}
      <div className="paginacion">
        <button
          className="btn btn-secundario"
          onClick={() => setPagina((p) => Math.max(1, p - 1))}
          disabled={pagina === 1 || cargando}
        >
          Anterior
        </button>
        <span>Página {pagina} de {Math.ceil(total / limite) || 1}</span>
        <button
          className="btn btn-secundario"
          onClick={() => setPagina((p) => p + 1)}
          disabled={pagina >= Math.ceil(total / limite) || cargando}
        >
          Siguiente
        </button>
        <select
          className="input"
          value={limite}
          onChange={(e) => { setLimite(parseInt(e.target.value)); setPagina(1); }}
          style={{ width: '80px' }}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Modal crear / editar / ver */}
      {modalAbierto && (
        <FormModal
          titulo={
            editando
              ? (soloLectura ? 'Ver usuario' : 'Editar usuario')
              : 'Nuevo usuario'
          }
          campos={editando ? camposFormEditar : camposFormCrear}
          valoresIniciales={editando ? valoresEditar : {}}
          onSubmit={handleSubmit}
          onCerrar={cerrarModal}
          errores={errores}
          guardando={guardando}
          soloLectura={soloLectura}
          renderVerUsuario={soloLectura && editando ? renderVerUsuario : undefined}
        />
      )}

      {/* Diálogo de confirmación */}
      {confirmacion && (
        <ConfirmDialog
          titulo={
            confirmacion.accion === 'eliminar' ? 'Eliminar usuario' :
            confirmacion.accion === 'aprobar'  ? 'Aprobar usuario'  :
            confirmacion.accion === 'rechazar' ? 'Rechazar usuario' :
            'Cambiar rol'
          }
          mensaje={
            confirmacion.accion === 'eliminar'
              ? `¿Eliminar al usuario "${confirmacion.fila.nombre}"? Esta acción no se puede deshacer.`
              : confirmacion.accion === 'aprobar'
              ? `¿Aprobar la cuenta de "${confirmacion.fila.nombre}"?`
              : confirmacion.accion === 'rechazar'
              ? `¿Rechazar la cuenta de "${confirmacion.fila.nombre}"?`
              : `¿Cambiar el rol de "${confirmacion.fila.nombre}"?`
          }
          textoConfirmar={
            confirmacion.accion === 'eliminar' ? 'Eliminar' :
            confirmacion.accion === 'aprobar'  ? 'Aprobar'  :
            confirmacion.accion === 'rechazar' ? 'Rechazar' : 'Cambiar'
          }
          enConfirmacion={false}
          onConfirmar={
            confirmacion.accion === 'eliminar'
              ? handleEliminar
              : handleAccionPendiente
          }
          onCancelar={() => setConfirmacion(null)}
          tipo={confirmacion.accion === 'eliminar' ? 'peligro' : 'primario'}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.tipo}`}>{toast.mensaje}</div>
      )}
    </div>
  );
}