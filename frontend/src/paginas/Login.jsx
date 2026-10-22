import { useRef, useState } from 'react';
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
  const captchaRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const usuario = await login(email, password, captchaId, captchaTexto);
      navigate(redirectPorRol(usuario));
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión. Inténtalo de nuevo.');
      captchaRef.current?.refrescar();
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-form-panel">
        <h1 className="auth-titulo">Bienvenido a tu <span>clínica</span></h1>
        <p className="auth-subtitulo">Ingresa tus credenciales para acceder al sistema</p>

        {error && (
          <div className="alerta-error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

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

          <Captcha
            ref={captchaRef}
            onCambio={(id, texto) => { setCaptchaId(id); setCaptchaTexto(texto); }}
          />

          <button type="submit" className="btn btn-primario" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="auth-link">
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </p>
      </div>

        <div className="auth-decor-panel">
        <img
          src="../public/Online Doctor-pana.png"
          alt="Ilustración de doctor"
          className="auth-ilustracion"
        />
      </div>
    </div>
  );
}
