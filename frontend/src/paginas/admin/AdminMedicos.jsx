import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  faPlus, faEdit, faTrash, faEye, faToggleOn, faToggleOff,
  faMagnifyingGlass, faUserMd, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiFetch, obtenerToken, urlArchivo } from '../../services/api';
import { formatearCosto } from '../../components/medicoHelpers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function iniciales(nombre) {
  const limpio = String(nombre || '').replace(/^Dr\.?\s+/i, '').trim();
  if (!limpio) return '?';
  return limpio
    .split(/\s+/)
    .map((parte) => parte[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function nombreVisible(medico) {
  return medico?.medico_mostrar || (medico?.nombre ? `Dr. ${medico.nombre}` : '—');
}

function formatTelefono(telefono) {
  if (!telefono) return null;
  const digitos = String(telefono).replace(/\D/g, '');
  if (digitos.length === 10) {
    return `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`;
  }
  return digitos.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

// Misma regla que el backend: solo dígitos, entre 7 y 15.
function validarTelefono(valor) {
  const digitos = String(valor ?? '').replace(/[\s\-()]/g, '');
  if (digitos === '') return null;
  if (!/^[0-9]{7,15}$/.test(digitos)) {
    return 'El teléfono debe tener entre 7 y 15 dígitos';
  }
  return null;
}

// Ids normalizados a string y ordenados para comparar arreglos sin falsos positivos.
function idsOrdenados(lista) {
  return (lista || []).map((item) => String(item)).sort();
}

function mismosIds(a, b) {
  const x = idsOrdenados(a);
  const y = idsOrdenados(b);
  return x.length === y.length && x.every((valor, i) => valor === y[i]);
}

function mapearError(err) {
  const mensaje = err.message || 'Error desconocido';
  const m = mensaje.toLowerCase();

  if (err.status === 409) {
    if (m.includes('email')) return { email: mensaje };
    if (m.includes('cédula') || m.includes('cedula')) return { cedula_profesional: mensaje };
    return { form: mensaje };
  }

  if (err.status === 400) {
    if (m.includes('email')) return { email: mensaje };
    if (m.includes('cédula') || m.includes('cedula')) return { cedula_profesional: mensaje };
    if (m.includes('contraseña') || m.includes('password')) return { password: mensaje };
    if (m.includes('teléfono') || m.includes('telefono')) return { telefono: mensaje };
    if (m.includes('costo')) return { costo_consulta: mensaje };
    if (m.includes('imagen') || m.includes('imág') || m.includes('foto') || m.includes('archivo')) return { foto: mensaje };
    if (m.includes('especialidad')) return { especialidades: mensaje };
    if (m.includes('consultorio')) return { consultorios: mensaje };
    if (m.includes('nombre')) return { nombre: mensaje };
    return { form: mensaje };
  }

  return null;
}

// ── Celda de especialidades (máx. 2 visibles + "+N") ──────────────────────
function CeldaEspecialidades({ especialidades = [] }) {
  if (!especialidades.length) return <span className="celda-vacia">—</span>;

  const visibles = especialidades.slice(0, 2);
  const restantes = especialidades.slice(2);

  return (
    <div className="celda-insignias">
      {visibles.map((esp) => (
        <span key={esp.id} className="badge badge-info" title={esp.nombre}>
          {esp.nombre}
        </span>
      ))}
      {restantes.length > 0 && (
        <span
          className="badge badge-inactivo"
          title={restantes.map((esp) => esp.nombre).join(', ')}
        >
          +{restantes.length}
        </span>
      )}
    </div>
  );
}

// ── Miniatura de foto para la tabla ────────────────────────────────────────
function CeldaFotoMedico({ fila }) {
  const [error, setError] = useState(false);
  const foto = urlArchivo(fila.foto_url);

  if (!foto || error) {
    return (
      <div className="medico-tabla-avatar" aria-hidden="true">
        {iniciales(fila.nombre)}
      </div>
    );
  }

  return (
    <img
      className="medico-tabla-foto"
      src={foto}
      alt={`Foto de ${nombreVisible(fila)}`}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

// ── Columnas ─────────────────────────────────────────────────────────────────
const columnas = [
  {
    clave: 'foto_url',
    titulo: 'Foto',
    render: (fila) => <CeldaFotoMedico fila={fila} />,
  },
  {
    clave: 'nombre',
    titulo: 'Médico',
    render: (fila) => (
      <div className="medico-celda">
        <div className="medico-celda-info">
          <span className="medico-nombre" title={nombreVisible(fila)}>{nombreVisible(fila)}</span>
          {fila.email && (
            <span className="medico-email" title={fila.email}>{fila.email}</span>
          )}
        </div>
      </div>
    ),
  },
  {
    clave: 'cedula_profesional',
    titulo: 'Cédula',
    render: (fila) =>
      fila.cedula_profesional
        ? <span className="celda-cedula">{fila.cedula_profesional}</span>
        : <span className="celda-vacia">—</span>,
  },
  {
    clave: 'especialidades',
    titulo: 'Especialidades',
    render: (fila) => <CeldaEspecialidades especialidades={fila.especialidades} />,
  },
  {
    clave: 'consultorios',
    titulo: 'Consultorios',
    render: (fila) => {
      const nombres = (fila.consultorios || []).map((c) => c.nombre);
      if (!nombres.length) return <span className="celda-vacia">—</span>;
      const texto = nombres.join(', ');
      return <span className="celda-truncada" title={texto}>{texto}</span>;
    },
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

// ── Componente principal ─────────────────────────────────────────────────────
export default function AdminMedicos() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('');
  const [filtroConsultorio, setFiltroConsultorio] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [especialidades, setEspecialidades] = useState([]);
  const [consultorios, setConsultorios] = useState([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [confirmacion, setConfirmacion] = useState(null);
  const [toast, setToast] = useState(null);
  const [soloLectura, setSoloLectura] = useState(false);

  // Evita que una respuesta lenta de un médico sobrescriba el modal de otro.
  const solicitudDetalleRef = useRef(0);

  // ── Toast ──────────────────────────────────────────────────────────────────
  function mostrarToast(mensaje, tipo = 'exito') {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Catálogos para filtros y selectores (solo activos) ────────────────────
  const cargarCatalogos = useCallback(async () => {
    setCargandoCatalogos(true);
    try {
      const token = obtenerToken();
      const [espData, conData] = await Promise.all([
        apiFetch('/api/especialidades', { token }),
        apiFetch('/api/consultorios', { token }),
      ]);
      const listaEsp = Array.isArray(espData) ? espData : (espData?.data ?? []);
      const listaCon = Array.isArray(conData) ? conData : (conData?.data ?? []);
      setEspecialidades(listaEsp.filter((e) => e.activo !== false));
      setConsultorios(listaCon.filter((c) => c.activo !== false));
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargandoCatalogos(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  // ── Carga de médicos ───────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const token = obtenerToken();
      const params = new URLSearchParams();
      if (mostrarInactivos) params.append('todos', 'true');
      if (filtroEspecialidad) params.append('especialidad', filtroEspecialidad);
      if (filtroConsultorio) params.append('consultorio', filtroConsultorio);
      if (busqueda.trim()) params.append('q', busqueda.trim());

      const query = params.toString();
      const data = await apiFetch(`/api/medicos${query ? `?${query}` : ''}`, { token });
      setDatos(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [mostrarInactivos, filtroEspecialidad, filtroConsultorio, busqueda]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ── Opciones de los selectores (activas + asignaciones actuales) ──────────
  // Si un médico ya tiene una especialidad/consultorio inactivo, se conserva
  // visible en edición para no perderlo sin querer.
  const opcionesEspecialidades = useMemo(() => {
    const opciones = especialidades.map((esp) => ({
      valor: String(esp.id),
      etiqueta: esp.nombre,
    }));
    if (!editando) return opciones;

    const conocidas = new Set(opciones.map((op) => op.valor));
    (editando.especialidades || []).forEach((esp) => {
      const valor = String(esp.id);
      if (!conocidas.has(valor)) {
        opciones.push({ valor, etiqueta: `${esp.nombre} (inactiva)` });
      }
    });
    return opciones;
  }, [especialidades, editando]);

  const opcionesConsultorios = useMemo(() => {
    const opciones = consultorios.map((con) => ({
      valor: String(con.id),
      etiqueta: con.nombre,
    }));
    if (!editando) return opciones;

    const conocidos = new Set(opciones.map((op) => op.valor));
    (editando.consultorios || []).forEach((con) => {
      const valor = String(con.id);
      if (!conocidos.has(valor)) {
        opciones.push({ valor, etiqueta: `${con.nombre} (inactivo)` });
      }
    });
    return opciones;
  }, [consultorios, editando]);

  // ── Apertura de modales ────────────────────────────────────────────────────
  // Ver y Editar cargan el detalle de GET /api/medicos/:id para mostrar
  // exactamente las especialidades y consultorios de ESE médico, no una copia
  // potencialmente desactualizada del listado.
  async function abrirDetalle(fila, lectura) {
    const solicitud = ++solicitudDetalleRef.current;
    setErrores({});
    try {
      const token = obtenerToken();
      const detalle = await apiFetch(`/api/medicos/${fila.id}`, { token });
      if (solicitud !== solicitudDetalleRef.current) return;

      setEditando(detalle);
      setSoloLectura(lectura);
      setModalAbierto(true);
    } catch (err) {
      if (solicitud !== solicitudDetalleRef.current) return;
      mostrarToast(err.message, 'error');
    }
  }

  function abrirNueva() {
    solicitudDetalleRef.current += 1;
    setEditando(null);
    setSoloLectura(false);
    setErrores({});
    setModalAbierto(true);
  }

  function abrirEditar(fila) {
    abrirDetalle(fila, false);
  }

  function abrirVer(fila) {
    abrirDetalle(fila, true);
  }

  function cerrarModal() {
    solicitudDetalleRef.current += 1;
    setModalAbierto(false);
    setSoloLectura(false);
    setEditando(null);
    setErrores({});
  }

  // ── Campos del formulario ──────────────────────────────────────────────────
  const hayEspecialidadesActivas = especialidades.length > 0;
  const hayConsultoriosActivos = consultorios.length > 0;

  const campos = useMemo(() => [
    {
      nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true,
      placeholder: 'Nombre completo del médico',
    },
    {
      nombre: 'email', etiqueta: 'Email', tipo: 'email', requerido: true,
      placeholder: 'medico@ejemplo.com',
    },
    {
      nombre: 'password',
      etiqueta: 'Contraseña',
      tipo: 'password',
      requerido: !editando,
      placeholder: editando ? 'Déjala vacía para no cambiarla' : 'Mínimo 8 caracteres',
      ayuda: editando
        ? 'Mínimo 8 caracteres. Déjala vacía para no cambiarla.'
        : 'Mínimo 8 caracteres.',
    },
    {
      nombre: 'cedula_profesional', etiqueta: 'Cédula profesional', tipo: 'text', requerido: true,
      placeholder: 'Ej. 12345678',
    },
    {
      nombre: 'telefono', etiqueta: 'Teléfono (opcional)', tipo: 'text', requerido: false,
      placeholder: 'Ej. 961 123 4567',
      ayuda: 'Entre 7 y 15 dígitos. Se guardan solo los dígitos.',
    },
    {
      nombre: 'foto', etiqueta: 'Foto de perfil (opcional)', tipo: 'file', requerido: false,
      accept: 'image/*',
      fotoActual: editando?.foto_url ? urlArchivo(editando.foto_url) : null,
      ayuda: 'JPG, PNG, WEBP o GIF. Máximo 5 MB.',
    },
    {
      nombre: 'costo_consulta', etiqueta: 'Costo de consulta (MXN)', tipo: 'number', requerido: false,
      placeholder: 'Ej. 500.00',
      min: 0,
      step: '0.01',
      ayuda: 'Opcional. Se muestra en el directorio de médicos.',
    },
    {
      nombre: 'especialidades', etiqueta: 'Especialidades', tipo: 'multiselect',
      opciones: opcionesEspecialidades,
      cargando: cargandoCatalogos,
      placeholder: 'Buscar especialidad…',
      ayuda: 'Se muestran las especialidades activas y las ya asignadas.',
      aviso: !cargandoCatalogos && !hayEspecialidadesActivas
        ? {
            mensaje: 'No hay especialidades activas. Crea o activa una para poder asignarla.',
            enlace: '/admin/especialidades',
            textoEnlace: 'Ir a Especialidades',
          }
        : null,
    },
    {
      nombre: 'consultorios', etiqueta: 'Consultorios', tipo: 'multiselect',
      opciones: opcionesConsultorios,
      cargando: cargandoCatalogos,
      placeholder: 'Buscar consultorio…',
      ayuda: 'Se muestran los consultorios activos y los ya asignados.',
      aviso: !cargandoCatalogos && !hayConsultoriosActivos
        ? {
            mensaje: 'No hay consultorios activos. Crea o activa uno para poder asignarlo.',
            enlace: '/admin/consultorios',
            textoEnlace: 'Ir a Consultorios',
          }
        : null,
    },
  ], [
    editando, opcionesEspecialidades, opcionesConsultorios, cargandoCatalogos,
    hayEspecialidadesActivas, hayConsultoriosActivos,
  ]);

  // Se memoiza para que el modal no reinicie los campos en cada render del
  // padre (por ejemplo, al mostrar un error del backend después de Guardar).
  const valoresIniciales = useMemo(() => (
    editando
      ? {
          nombre: editando.nombre || '',
          email: editando.email || '',
          password: '',
          cedula_profesional: editando.cedula_profesional || '',
          telefono: editando.telefono || '',
          foto: null,
          costo_consulta: editando.costo_consulta ?? '',
          especialidades: (editando.especialidades || []).map((esp) => String(esp.id)),
          consultorios: (editando.consultorios || []).map((con) => String(con.id)),
        }
      : {
          nombre: '',
          email: '',
          password: '',
          cedula_profesional: '',
          telefono: '',
          foto: null,
          costo_consulta: '',
          especialidades: [],
          consultorios: [],
        }
  ), [editando]);

  // ── Guardar (crear / editar) ───────────────────────────────────────────────
  async function handleSubmit(valores) {
    setErrores({});

    const esCreacion = !editando;
    const erroresLocales = {};

    if (!valores.nombre?.trim()) {
      erroresLocales.nombre = 'El nombre es requerido';
    }
    if (!valores.email?.trim()) {
      erroresLocales.email = 'El email es requerido';
    }
    if (!valores.cedula_profesional?.trim()) {
      erroresLocales.cedula_profesional = 'La cédula profesional es requerida';
    }
    if (esCreacion && (!valores.password || valores.password.length < 8)) {
      erroresLocales.password = 'La contraseña debe tener al menos 8 caracteres';
    }
    if (!esCreacion && valores.password && valores.password.length < 8) {
      erroresLocales.password = 'La contraseña debe tener al menos 8 caracteres';
    }

    const errorTelefono = validarTelefono(valores.telefono);
    if (errorTelefono) erroresLocales.telefono = errorTelefono;

    const costoTexto = String(valores.costo_consulta ?? '').trim();
    if (costoTexto !== '') {
      const costo = Number(costoTexto);
      if (!Number.isFinite(costo) || costo < 0) {
        erroresLocales.costo_consulta = 'El costo debe ser un número mayor o igual a 0';
      }
    }

    if (valores.foto instanceof File) {
      if (!TIPOS_FOTO.includes(valores.foto.type)) {
        erroresLocales.foto = 'Solo se permiten imágenes JPG, PNG, WEBP o GIF';
      } else if (valores.foto.size > 5 * 1024 * 1024) {
        erroresLocales.foto = 'La imagen no puede superar los 5 MB';
      }
    }

    if (Object.keys(erroresLocales).length > 0) {
      setErrores(erroresLocales);
      return;
    }

    setGuardando(true);
    try {
      const token = obtenerToken();

      // FormData permite enviar la foto junto con el resto de los campos.
      const formData = new FormData();
      formData.append('nombre', valores.nombre.trim());
      formData.append('email', valores.email.trim());
      formData.append('cedula_profesional', valores.cedula_profesional.trim());
      formData.append('telefono', valores.telefono || '');
      formData.append('costo_consulta', costoTexto);

      // En creación la contraseña es obligatoria; en edición solo si se escribió.
      if (valores.password) formData.append('password', valores.password);
      if (valores.foto instanceof File) formData.append('foto', valores.foto);

      if (esCreacion) {
        formData.append('especialidades', JSON.stringify((valores.especialidades || []).map(Number)));
        formData.append('consultorios', JSON.stringify((valores.consultorios || []).map(Number)));

        await apiFetch('/api/medicos', {
          method: 'POST',
          body: formData,
          token,
        });
        mostrarToast('Médico creado correctamente');
      } else {
        await apiFetch(`/api/medicos/${editando.id}`, {
          method: 'PUT',
          body: formData,
          token,
        });

        // Especialidades y consultorios se guardan con sus PUT dedicados
        // únicamente si cambiaron (igual que el rol en Usuarios).
        const especialidadesOriginales = (editando.especialidades || []).map((esp) => String(esp.id));
        if (!mismosIds(especialidadesOriginales, valores.especialidades)) {
          await apiFetch(`/api/medicos/${editando.id}/especialidades`, {
            method: 'PUT',
            body: { especialidades: (valores.especialidades || []).map(Number) },
            token,
          });
        }

        const consultoriosOriginales = (editando.consultorios || []).map((con) => String(con.id));
        if (!mismosIds(consultoriosOriginales, valores.consultorios)) {
          await apiFetch(`/api/medicos/${editando.id}/consultorios`, {
            method: 'PUT',
            body: { consultorios: (valores.consultorios || []).map(Number) },
            token,
          });
        }

        mostrarToast('Médico actualizado correctamente');
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
      await apiFetch(`/api/medicos/${fila.id}/estado`, {
        method: 'PATCH',
        body: { activo: !fila.activo },
        token,
      });
      mostrarToast(fila.activo ? 'Médico desactivado' : 'Médico activado');
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
      await apiFetch(`/api/medicos/${fila.id}`, { method: 'DELETE', token });
      mostrarToast('Médico eliminado correctamente');
      cargarDatos();
    } catch (err) {
      // 409 → "El médico tiene citas pendientes"
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

  // ── Vista "Ver médico" (solo lectura) ─────────────────────────────────────
  function renderVerMedico() {
    if (!editando) return null;
    const m = editando;
    const tel = formatTelefono(m.telefono);

    return (
      <dl className="ver-usuario-lista">
        <div className="ver-usuario-fila">
          <dt>Foto</dt>
          <dd>
            {m.foto_url ? (
              <img
                className="ver-medico-foto"
                src={urlArchivo(m.foto_url)}
                alt={`Foto de ${nombreVisible(m)}`}
              />
            ) : (
              <span className="celda-vacia">Sin foto</span>
            )}
          </dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Nombre</dt>
          <dd>{nombreVisible(m)}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Email</dt>
          <dd>{m.email || <span className="celda-vacia">—</span>}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Cédula profesional</dt>
          <dd>{m.cedula_profesional || <span className="celda-vacia">—</span>}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Teléfono</dt>
          <dd>{tel || <span className="celda-vacia">—</span>}</dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Costo de consulta</dt>
          <dd>
            {m.costo_consulta === null || m.costo_consulta === undefined || m.costo_consulta === ''
              ? <span className="celda-vacia">—</span>
              : formatearCosto(m.costo_consulta)}
          </dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Estado</dt>
          <dd>
            <span className={`badge ${m.activo ? 'badge-exito' : 'badge-inactivo'}`}>
              {m.activo ? 'Activo' : 'Inactivo'}
            </span>
          </dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Especialidades</dt>
          <dd>
            {(m.especialidades || []).length > 0 ? (
              <div className="ver-badges">
                {m.especialidades.map((esp) => (
                  <span key={esp.id} className="badge badge-info">{esp.nombre}</span>
                ))}
              </div>
            ) : (
              <span className="celda-vacia">—</span>
            )}
          </dd>
        </div>
        <div className="ver-usuario-fila">
          <dt>Consultorios</dt>
          <dd>
            {(m.consultorios || []).length > 0 ? (
              <div className="ver-badges">
                {m.consultorios.map((con) => (
                  <span key={con.id} className="badge badge-info">{con.nombre}</span>
                ))}
              </div>
            ) : (
              <span className="celda-vacia">—</span>
            )}
          </dd>
        </div>
      </dl>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const esEliminar = confirmacion?.accion === 'eliminar';
  const esActivar = confirmacion?.accion === 'activar';
  const hayFiltros = Boolean(
    busqueda.trim() || filtroEspecialidad || filtroConsultorio || mostrarInactivos
  );

  function limpiarFiltros() {
    setBusqueda('');
    setFiltroEspecialidad('');
    setFiltroConsultorio('');
    setMostrarInactivos(false);
  }

  return (
    <div className="admin-medicos">
      <div className="admin-medicos-encabezado">
        <div className="admin-medicos-titulo">
          <span className="admin-medicos-icono" aria-hidden="true">
            <FontAwesomeIcon icon={faUserMd} />
          </span>
          <div>
            <h2>Médicos</h2>
            <p>Administra el equipo médico, sus especialidades, consultorios y costo de consulta.</p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primario admin-medicos-nuevo"
          onClick={abrirNueva}
        >
          <FontAwesomeIcon icon={faPlus} />
          <span>Nuevo médico</span>
        </button>
      </div>

      <section className="admin-medicos-filtros" aria-label="Filtros de médicos">
        <div className="admin-medicos-busqueda">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="admin-medicos-busqueda-icono"
            aria-hidden="true"
          />
          <input
            type="text"
            className="input"
            placeholder="Buscar por nombre o cédula"
            aria-label="Buscar médico"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <select
          className="input"
          value={filtroEspecialidad}
          onChange={(e) => setFiltroEspecialidad(e.target.value)}
          aria-label="Filtrar por especialidad"
        >
          <option value="">Especialidad: todas</option>
          {especialidades.map((esp) => (
            <option key={esp.id} value={String(esp.id)}>{esp.nombre}</option>
          ))}
        </select>

        <select
          className="input"
          value={filtroConsultorio}
          onChange={(e) => setFiltroConsultorio(e.target.value)}
          aria-label="Filtrar por consultorio"
        >
          <option value="">Consultorio: todos</option>
          {consultorios.map((con) => (
            <option key={con.id} value={String(con.id)}>{con.nombre}</option>
          ))}
        </select>

        <label className="admin-medicos-check">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
          />
          <span>Mostrar inactivos</span>
        </label>
      </section>

      {!cargando && (
        <div className="admin-medicos-resumen">
          <span>
            <strong>{datos.length}</strong>{' '}
            {datos.length === 1 ? 'médico' : 'médicos'}
            {hayFiltros
              ? (datos.length === 1 ? ' encontrado' : ' encontrados')
              : ' en total'}
          </span>
          {hayFiltros && (
            <button type="button" className="admin-medicos-limpiar" onClick={limpiarFiltros}>
              <FontAwesomeIcon icon={faXmark} />
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio={
          hayFiltros
            ? 'No hay médicos que coincidan con los filtros'
            : 'No hay médicos registrados'
        }
        buscar={false}
      />

      {modalAbierto && (
        <FormModal
          key={`${soloLectura ? 'ver' : 'form'}-${editando?.id ?? 'nuevo'}`}
          titulo={
            editando
              ? (soloLectura ? 'Ver médico' : 'Editar médico')
              : 'Nuevo médico'
          }
          campos={campos}
          valoresIniciales={valoresIniciales}
          onSubmit={handleSubmit}
          onCerrar={cerrarModal}
          errores={errores}
          guardando={guardando}
          soloLectura={soloLectura}
          renderVerUsuario={soloLectura && editando ? renderVerMedico : undefined}
        />
      )}

      {confirmacion && (
        <ConfirmDialog
          titulo={
            esEliminar ? 'Eliminar médico' :
            esActivar ? 'Activar médico' : 'Desactivar médico'
          }
          mensaje={
            esEliminar
              ? `¿Eliminar al médico "${nombreVisible(confirmacion.fila)}"? Se ocultará del sistema, pero se conservará el historial de citas.`
              : esActivar
              ? `¿Activar al médico "${nombreVisible(confirmacion.fila)}"? Volverá a estar disponible para agendar citas.`
              : `¿Desactivar al médico "${nombreVisible(confirmacion.fila)}"? Dejará de ofrecerse para nuevas citas.`
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
