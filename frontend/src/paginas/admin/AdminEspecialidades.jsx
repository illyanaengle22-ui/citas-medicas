import { useState, useEffect, useCallback } from 'react';
import { faPlus, faEdit, faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiFetch, obtenerToken } from '../../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';


const columnas = [
  { clave: 'nombre', titulo: 'Nombre' },
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

  const mostrarToast = (mensaje, tipo = 'exito') => {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const abrirNueva = () => {
    setEditando(null);
    setErrores({});
    setModalAbierto(true);
  };

  const abrirEditar = (fila) => {
    setEditando(fila);
    setErrores({});
    setModalAbierto(true);
  };

  const handleSubmit = async (valores) => {
    setGuardando(true);
    setErrores({});
    try {
      const token = obtenerToken();
      if (editando) {
        await apiFetch(`/api/especialidades/${editando.id}`, {
          method: 'PUT',
          body: valores,
          token,
        });
        mostrarToast('Especialidad actualizada correctamente');
      } else {
        await apiFetch('/api/especialidades', {
          method: 'POST',
          body: valores,
          token,
        });
        mostrarToast('Especialidad creada correctamente');
      }
      setModalAbierto(false);
      cargarDatos();
    } catch (err) {
      if (err.status === 409) {
        setErrores({ nombre: err.message });
      } else {
        mostrarToast(err.message, 'error');
      }
    } finally {
      setGuardando(false);
    }
  };

  const pedirConfirmacion = (fila) => {
    setConfirmacion(fila);
  };

  const handleCambiarEstado = async () => {
    if (!confirmacion) return;
    const fila = confirmacion;
    setConfirmacion(null);
    try {
      const token = await obtenerToken();
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
  };

  const acciones = [
    {
      icono: faEdit,
      titulo: 'Editar',
      onClick: abrirEditar,
    },
    {
      icono: confirmacion?.activo ? faToggleOff : faToggleOn,
      titulo: confirmacion?.activo ? 'Desactivar' : 'Activar',
      onClick: pedirConfirmacion,
    },
  ];

  return (
    <div className="admin-especialidades">
      <div className="filtros-barra">
        <h2>Especialidades</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
        placeholderBuscar="Buscar por nombre..."
      />

      {modalAbierto && (
        <FormModal
          titulo={editando ? 'Editar especialidad' : 'Nueva especialidad'}
          campos={camposForm}
          valoresIniciales={editando ? { nombre: editando.nombre } : {}}
          onSubmit={handleSubmit}
          onCerrar={() => setModalAbierto(false)}
          errores={errores}
          guardando={guardando}
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
