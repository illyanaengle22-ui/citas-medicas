import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCopy,
  faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';
import { apiFetch } from '../services/api';

// Muestra el estado de vinculación con Telegram y genera el código de un solo
// uso que el paciente escribe en el bot como "/start CÓDIGO" (RN-116).
export default function VincularTelegram() {
  const [vinculado, setVinculado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [comando, setComando] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    apiFetch('/api/telegram/estado')
      .then((data) => vivo && setVinculado(Boolean(data?.vinculado)))
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  async function generarCodigo() {
    setGenerando(true);
    setError('');
    setCopiado(false);
    try {
      const data = await apiFetch('/api/telegram/codigo', { method: 'POST' });
      setComando(data.comando);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(comando);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  if (cargando) return null;

  return (
    <section className="panel panel-telegram" aria-labelledby="titulo-telegram">
      <header className="panel-header">
        <FontAwesomeIcon icon={faPaperPlane} className="panel-icono" aria-hidden="true" />
        <h2 id="titulo-telegram">Asistente en Telegram</h2>
      </header>

      <div className="panel-cuerpo panel-telegram-cuerpo">
        <p className="panel-fila-secundario">
          Consulta y gestiona tus citas desde Telegram con nuestro asistente
          inteligente. Vincula tu cuenta para comenzar.
        </p>

        {error && (
          <p className="dash-error-inline" role="alert">
            {error}
          </p>
        )}

        {vinculado ? (
          <p className="telegram-estado-ok">
            <FontAwesomeIcon icon={faCheckCircle} aria-hidden="true" />
            Tu cuenta ya está vinculada a Telegram.
          </p>
        ) : (
          <>
            <div className="dashboard-acciones-grandes">
              <button
                type="button"
                className="btn btn-primario"
                onClick={generarCodigo}
                disabled={generando}
              >
                <FontAwesomeIcon icon={faPaperPlane} aria-hidden="true" />
                {generando ? 'Generando...' : 'Generar código de vinculación'}
              </button>
            </div>

            {comando && (
              <div className="telegram-codigo-caja">
                <p>
                  Abre <strong>@CitaFacilBot</strong> en Telegram y envía este comando:
                </p>
                <div className="telegram-codigo-fila">
                  <code className="telegram-codigo">{comando}</code>
                  <button
                    type="button"
                    className="btn btn-secundario btn-copiar"
                    onClick={copiar}
                  >
                    <FontAwesomeIcon icon={faCopy} aria-hidden="true" />
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="telegram-codigo-nota">
                  Caduca en 15 minutos y solo sirve una vez.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
