import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Captcha from '../components/Captcha';
import { faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function Login() {
  const { login, redirectPorRol } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaTexto, setCaptchaTexto] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const usuario = await login(email, password, captchaId, captchaTexto);
      navigate(redirectPorRol(usuario));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-form-panel">
        <h1 className="auth-titulo">Bienvenido a tu <span>clínica</span></h1>
        <p className="auth-subtitulo">Ingresa tus credenciales para acceder al sistema</p>

        {error && <div className="alerta-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form">
          <div className="input-grupo">
            <FontAwesomeIcon icon={faEnvelope} className="input-icono" />
            <input
              type="email"
              className="input"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-grupo">
            <FontAwesomeIcon icon={faLock} className="input-icono" />
            <input
              type="password"
              className="input"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Captcha onCambio={(id, texto) => { setCaptchaId(id); setCaptchaTexto(texto); }} />

          <button type="submit" className="btn btn-primario" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="auth-link">
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </p>
      </div>

      <div className="auth-decor-panel">
        <svg viewBox="0 0 400 400" className="auth-ilustracion" xmlns="http://www.w3.org/2000/svg">
          <circle cx="200" cy="200" r="180" fill="#E6F2FB" />
          <rect x="160" y="120" width="80" height="160" rx="16" fill="#5E9BBA" />
          <rect x="140" y="150" width="120" height="30" rx="8" fill="#5E9BBA" transform="rotate(90 200 165)" />
          <circle cx="200" cy="200" r="60" fill="#B8A528" opacity="0.3" />
          <path d="M180 200 L200 180 L220 200 L200 220 Z" fill="#2A1B4F" />
          <rect x="170" y="260" width="60" height="8" rx="4" fill="#2A1B4F" opacity="0.2" />
          <rect x="160" y="280" width="80" height="8" rx="4" fill="#2A1B4F" opacity="0.1" />
        </svg>
      </div>
    </div>
  );
}
