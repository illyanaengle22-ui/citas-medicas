import { useState, useEffect, useRef } from 'react';
import { faCamera, faSave, faUser, faEnvelope, faLock, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '../context/AuthContext';
import { obtenerToken } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function MiPerfil() {
  const { actualizarUsuario } = useAuth();

  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);
  const [errores, setErrores] = useState({});

  // Campos del formulario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');

  // Foto
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  const inputFotoRef = useRef(null);

  function mostrarToast(mensaje, tipo = 'exito') {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  // Libera las URLs temporales creadas con URL.createObjectURL.
  useEffect(() => {
    return () => {
      if (fotoPreview?.startsWith('blob:')) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function cargar() {
      try {
        const token = obtenerToken();
        const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.ok) {
          const p = json.data;
          setPerfil(p);
          setNombre(p.nombre || '');
          setEmail(p.email || '');
          if (p.foto_url) {
            setFotoPreview(`${API_URL}${p.foto_url}`);
          }
        }
      } catch {
        mostrarToast('No se pudo cargar el perfil', 'error');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  // ── Manejo de foto ────────────────────────────────────────────────────────────
  function onSeleccionarFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      mostrarToast('La imagen no puede superar los 5 MB', 'error');
      e.target.value = '';
      return;
    }
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  // ── Guardar ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};

    if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!email.trim()) errs.email = 'El email es obligatorio';
    if (password && password.length < 8) errs.password = 'Mínimo 8 caracteres';
    if (password && password !== confirmar) errs.confirmar = 'Las contraseñas no coinciden';

    if (Object.keys(errs).length > 0) {
      setErrores(errs);
      return;
    }
    setErrores({});

    setGuardando(true);
    try {
      const token = obtenerToken();
      const formData = new FormData();
      formData.append('nombre', nombre.trim());
      formData.append('email', email.trim());
      if (password) formData.append('password', password);
      if (fotoFile) formData.append('foto', fotoFile);

      const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.mensaje || 'Error al guardar');

      // Actualiza preview si hay nueva foto_url
      if (json.data?.foto_url) {
        setFotoPreview(`${API_URL}${json.data.foto_url}`);
      }

      // Refleja los datos guardados en la tarjeta y en el contexto global.
      setPerfil((prev) => (prev ? { ...prev, ...json.data } : json.data));
      setNombre(json.data.nombre || '');
      setEmail(json.data.email || '');
      actualizarUsuario({
        nombre: json.data.nombre,
        email: json.data.email,
        foto_url: json.data.foto_url || null,
      });

      setPassword('');
      setConfirmar('');
      setFotoFile(null);
      if (inputFotoRef.current) inputFotoRef.current.value = '';
      mostrarToast('Perfil actualizado correctamente');
    } catch (err) {
      if (err.message?.includes('email')) {
        setErrores({ email: err.message });
      } else {
        mostrarToast(err.message || 'Error al guardar', 'error');
      }
    } finally {
      setGuardando(false);
    }
  }

  const rolLabel = {
    admin: 'Administrador',
    medico: 'Médico',
    paciente: 'Paciente',
  }[perfil?.rol] || perfil?.rol || '—';

  const estadoClase = {
    activo: 'badge-exito',
    pendiente: 'badge-pendiente',
    rechazado: 'badge-error',
  }[perfil?.estado] || 'badge-info';

  // ── Render ───────────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="crud-cargando">
        <div className="spinner" />
        <span>Cargando perfil…</span>
      </div>
    );
  }

  return (
    <div className="mi-perfil-page">
      <h2 className="dashboard-titulo">Mi Perfil</h2>

      <div className="perfil-grid">
        {/* ── Tarjeta de identidad ─────────────────────────────── */}
        <div className="perfil-card-identidad">
          {/* Avatar / foto */}
          <div className="perfil-avatar-wrapper">
            <div className="perfil-avatar">
              {fotoPreview ? (
                <img
                  src={fotoPreview}
                  alt="Foto de perfil"
                  className="perfil-avatar-img"
                />
              ) : (
                <span className="perfil-avatar-iniciales">
                  {iniciales(nombre || perfil?.nombre || '')}
                </span>
              )}
            </div>
            <button
              type="button"
              className="perfil-avatar-btn"
              onClick={() => inputFotoRef.current?.click()}
              title="Cambiar foto"
            >
              <FontAwesomeIcon icon={faCamera} />
            </button>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="perfil-input-file"
              onChange={onSeleccionarFoto}
            />
          </div>

          <h3 className="perfil-nombre">{perfil?.nombre}</h3>
          <p className="perfil-email-display">{perfil?.email}</p>

          <div className="perfil-badges">
            <span className="badge badge-info">{rolLabel}</span>
            <span className={`badge ${estadoClase}`}>
              {perfil?.estado === 'activo' ? 'Activo' : perfil?.estado}
            </span>
          </div>

          <dl className="perfil-meta">
            <div>
              <dt>Miembro desde</dt>
              <dd>
                {perfil?.created_at
                  ? new Date(perfil.created_at).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Último acceso</dt>
              <dd>
                {perfil?.ultimo_login
                  ? new Date(perfil.ultimo_login).toLocaleString('es-MX', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : 'Nunca'}
              </dd>
            </div>
          </dl>
        </div>

        {/* ── Formulario de edición ─────────────────────────────── */}
        <div className="perfil-card-form">
          <h3 className="perfil-seccion-titulo">Editar información</h3>
          <form onSubmit={handleSubmit} className="form perfil-form" noValidate>

            {/* Nombre */}
            <div className="form-campo">
              <label className="form-label" htmlFor="perfil-nombre">
                Nombre completo <span className="form-requerido">*</span>
              </label>
              <div className="input-grupo">
                <FontAwesomeIcon icon={faUser} className="input-icono" />
                <input
                  id="perfil-nombre"
                  type="text"
                  className={`input${errores.nombre ? ' input-error' : ''}`}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre completo"
                />
              </div>
              {errores.nombre && <span className="form-error">{errores.nombre}</span>}
            </div>

            {/* Email */}
            <div className="form-campo">
              <label className="form-label" htmlFor="perfil-email">
                Correo electrónico <span className="form-requerido">*</span>
              </label>
              <div className="input-grupo">
                <FontAwesomeIcon icon={faEnvelope} className="input-icono" />
                <input
                  id="perfil-email"
                  type="email"
                  className={`input${errores.email ? ' input-error' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                />
              </div>
              {errores.email && <span className="form-error">{errores.email}</span>}
            </div>

            <hr className="perfil-divider" />
            <p className="perfil-seccion-nota">
              Deja los campos de contraseña vacíos si no deseas cambiarla.
            </p>

            {/* Nueva contraseña */}
            <div className="form-campo">
              <label className="form-label" htmlFor="perfil-password">
                Nueva contraseña
              </label>
              <div className="input-grupo">
                <FontAwesomeIcon icon={faLock} className="input-icono" />
                <input
                  id="perfil-password"
                  type="password"
                  className={`input${errores.password ? ' input-error' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
              </div>
              {errores.password && <span className="form-error">{errores.password}</span>}
            </div>

            {/* Confirmar contraseña */}
            <div className="form-campo">
              <label className="form-label" htmlFor="perfil-confirmar">
                Confirmar contraseña
              </label>
              <div className="input-grupo">
                <FontAwesomeIcon icon={faLock} className="input-icono" />
                <input
                  id="perfil-confirmar"
                  type="password"
                  className={`input${errores.confirmar ? ' input-error' : ''}`}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  autoComplete="new-password"
                />
              </div>
              {errores.confirmar && <span className="form-error">{errores.confirmar}</span>}
            </div>

            {/* Botón guardar */}
            <div className="perfil-form-footer">
              {fotoFile && (
                <span className="perfil-foto-nueva">
                  <FontAwesomeIcon icon={faCheckCircle} /> Nueva foto seleccionada
                </span>
              )}
              <button
                type="submit"
                className="btn btn-primario"
                disabled={guardando}
              >
                {guardando ? (
                  <>
                    <span className="spinner spinner-sm" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faSave} />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.tipo}`}>{toast.mensaje}</div>
      )}
    </div>
  );
}
