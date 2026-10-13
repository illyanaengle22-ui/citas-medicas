import { useState, useEffect, useCallback, useRef } from 'react';
import { obtenerCaptcha } from '../services/api';
import { faRefresh } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function Captcha({ onCambio }) {
  const [captchaId, setCaptchaId] = useState('');
  const [svg, setSvg] = useState('');
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);

  // Guardamos onCambio en un ref para no tenerlo como dependencia
  const onCambioRef = useRef(onCambio);
  useEffect(() => {
    onCambioRef.current = onCambio;
  }, [onCambio]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerCaptcha();
      setCaptchaId(data.captchaId);
      setSvg(data.svg);
      setTexto('');
      onCambioRef.current?.(data.captchaId, '');
    } catch (err) {
      console.error('Error al cargar captcha:', err);
    } finally {
      setCargando(false);
    }
  }, []);   // ← Array VACÍO: cargar nunca se recrea

  useEffect(() => {
    cargar();
  }, [cargar]);   // ← ahora cargar es estable, solo se ejecuta 1 vez

  const handleTextoChange = (valor) => {
    setTexto(valor);
    onCambioRef.current?.(captchaId, valor);
  };

  return (
    <div className="captcha">
      <label className="captcha-label">Verificación de seguridad</label>
      <div className="captcha-imagen">
        {cargando ? (
          <div className="captcha-cargando">Cargando...</div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        <button
          type="button"
          className="captcha-refrescar"
          onClick={cargar}
          aria-label="Refrescar captcha"
        >
          <FontAwesomeIcon icon={faRefresh} />
        </button>
      </div>
      <input
        type="text"
        className="input"
        placeholder="Escribe el texto de la imagen"
        value={texto}
        onChange={(e) => handleTextoChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}