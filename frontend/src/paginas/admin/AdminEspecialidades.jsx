import { useState, useEffect, useCallback } from 'react';
import { faPlus, faEdit, faToggleOn, faToggleOff, faEye } from '@fortawesome/free-solid-svg-icons';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiFetch, obtenerToken } from '../../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const columnas = [
  { clave: 'nombre', titulo: 'Nombre' },
  {
    clave: 'descripcion',
    titulo: 'Descripción',
    render: (fila) =>
      fila.descripcion ? (
        <span className="celda-truncada" title={fila.descripcion}>
          {fila.descripcion.length > 60
            ? `${fila.descripcion.slice(0, 60)}…`
            : fila.descripcion}
        </span>
      ) : (
        <span className="celda-vacia">—</span>
      ),
  },
  {
    clave: 'activo',
    titulo: 'Estado',
    render: (fila) => (
      <span className={`badge ${fila.activo ? 'badge-exito' : 'badge-inactivo'}`}>
        {fila.activo ? 'Activa' : 'Inactiva'}
      </span>
    ),
  },
];

const camposForm = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, placeholder: 'Ej. Cardiología' },
  { nombre: 'descripcion', etiqueta: 'Descripción (opcional)', tipo: 'textarea', placeholder: 'Breve descripción de la especialidad', filas: 3 },
];

export default function AdminEspecialidades() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [todas, setTodas] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [confirmacion, setConfirmacion] = useState(null);
  const [toast, setToast] = useState(null);
  const [soloLectura, setSoloLectura] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const token = obtenerToken();
      const url = todas ? '/api/especialidades?todas=true' : '/api/especialidades';
      const data = await apiFetch(url, { token });
      setDatos(data);
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [todas]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function mostrarToast(mensaje, tipo = 'exito') {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  function abrirNueva() {
    setEditando(null);
    setErrores({});
    setModalAbierto(true);
  }

  function abrirEditar(fila) {
    setEditando(fila);
    setErrores({});
    setModalAbierto(true);
  }

  async function handleSubmit(valores) {
    setGuardando(true);
    setErrores({});
    try {
      const token = obtenerToken();
      const cuerpo = {
        nombre: valores.nombre,
        descripcion: valores.descripcion || '',
      };
      if (editando) {
        await apiFetch(`/api/especialidades/${editando.id}`, {
          method: 'PUT',
          body: cuerpo,
          token,
        });
        mostrarToast('Especialidad actualizada correctamente');
      } else {
        await apiFetch('/api/especialidades', {
          method: 'POST',
          body: cuerpo,
          token,
        });
        mostrarToast('Especialidad creada correctamente');
      }
      setModalAbierto(false);
      cargarDatos();
    } catch (err) {
      if (err.status === 409) {
        setErrores({ nombre: err.message });
      } else if (err.status === 400) {
        setErrores({ descripcion: err.message });
      } else {
        mostrarToast(err.message, 'error');
      }
    } finally {
      setGuardando(false);
    }
  }

  function pedirConfirmacion(fila) {
    setConfirmacion(fila);
  }

  async function handleCambiarEstado() {
    if (!confirmacion) return;
    const fila = confirmacion;
    setConfirmacion(null);
    try {
      const token = obtenerToken();
      await apiFetch(`/api/especialidades/${fila.id}/estado`, {
        method: 'PATCH',
        body: { activo: !fila.activo },
        token,
      });
      mostrarToast(fila.activo ? 'Especialidad desactivada' : 'Especialidad activada');
      cargarDatos();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  }

  const abrirVer = (fila) => {
    // Modo solo lectura - solo muestra los datos
    setSoloLectura(true);
    setEditando(fila);
    setErrores({});
    setModalAbierto(true);
  };

  const acciones = [
    {
      icono: faEye,
      titulo: 'Ver',
      onClick: abrirVer,
    },
    {
      icono: faEdit,
      titulo: 'Editar',
      onClick: abrirEditar,
    },
    {
      icono: faToggleOff,
      titulo: 'Desactivar',
      onClick: pedirConfirmacion,
      mostrar: (fila) => fila.activo,
    },
    {
      icono: faToggleOn,
      titulo: 'Activar',
      onClick: pedirConfirmacion,
      mostrar: (fila) => !fila.activo,
    },
  ];

  return (
    <div className="admin-especialidades">
      <div className="filtros-barra">
        <h2>Especialidades</h2>
        <div className="filtros-acciones">
          <label className="form-checkbox-label">
            <input
              type="checkbox"
              checked={todas}
              onChange={(e) => setTodas(e.target.checked)}
            />
            <span>Mostrar inactivas</span>
          </label>
          <button className="btn btn-primario" onClick={abrirNueva}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Nueva especialidad</span>
          </button>
        </div>
      </div>

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="No hay especialidades registradas"
        buscar={true}
        placeholderBuscar="Buscar por nombre o descripción..."
      />

      {modalAbierto && (
        <FormModal
          titulo={editando ? (soloLectura ? 'Ver especialidad' : 'Editar especialidad') : 'Nueva especialidad'}
          campos={camposForm}
          valoresIniciales={editando ? { nombre: editando.nombre, descripcion: editando.descripcion || '' } : {}}
          onSubmit={handleSubmit}
          onCerrar={() => { setModalAbierto(false); setSoloLectura(false); setEditando(null); }}
          errores={errores}
          guardando={guardando}
          soloLectura={soloLectura}
        />
      )}

      {confirmacion && (
        <ConfirmDialog
          titulo={confirmacion.activo ? 'Desactivar especialidad' : 'Activar especialidad'}
          mensaje={`¿Estás seguro de ${confirmacion.activo ? 'desactivar' : 'activar'} la especialidad "${confirmacion.nombre}"?`}
          textoConfirmar={confirmacion.activo ? 'Desactivar' : 'Activar'}
          enConfirmacion={false}
          onConfirmar={handleCambiarEstado}
          onCancelar={() => setConfirmacion(null)}
          tipo="peligro"
        />
      )}

      {toast && (
        <div className={`toast toast-${toast.tipo}`}>
          {toast.mensaje}
        </div>
      )}
    </div>
  );
}
