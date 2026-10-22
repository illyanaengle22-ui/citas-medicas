import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faBars,
  faBaby,
  faBone,
  faCalendarCheck,
  faCircleCheck,
  faClock,
  faEnvelope,
  faEye,
  faHandHoldingHeart,
  faHeartPulse,
  faLocationDot,
  faNotesMedical,
  faPhone,
  faShieldHalved,
  faStethoscope,
  faUserDoctor,
  faXmark,
  faAllergies,
} from '@fortawesome/free-solid-svg-icons';
import './Landing.css';

const especialidades = [
  {
    icono: faHeartPulse,
    nombre: 'Cardiología',
    descripcion: 'Prevención, diagnóstico y seguimiento para cuidar la salud de tu corazón.',
  },
  {
    icono: faBaby,
    nombre: 'Pediatría',
    descripcion: 'Acompañamiento cercano para el bienestar y desarrollo de los más pequeños.',
  },
  {
    icono: faStethoscope,
    nombre: 'Medicina General',
    descripcion: 'Atención integral para resolver tus dudas y orientar tu cuidado diario.',
  },
  {
    icono: faEye,
    nombre: 'Oftalmología',
    descripcion: 'Evaluación y tratamiento para proteger tu visión y salud ocular.',
  },
  {
    icono: faBone,
    nombre: 'Traumatología',
    descripcion: 'Cuidado especializado para lesiones, dolores y problemas del aparato locomotor.',
  },
  {
    icono: faAllergies,
    nombre: 'Dermatología',
    descripcion: 'Diagnóstico y tratamiento para mantener tu piel sana y protegida.',
  },
];

const beneficios = [
  { icono: faCalendarCheck, titulo: 'Agenda en línea', texto: 'Reserva en minutos' },
  { icono: faUserDoctor, titulo: 'Médicos verificados', texto: 'Profesionales certificados' },
  { icono: faShieldHalved, titulo: 'Datos protegidos', texto: 'Tu información segura' },
];

const valores = [
  {
    icono: faHandHoldingHeart,
    titulo: 'Atención humana',
    texto: 'Cada cita está pensada para que te sientas escuchado y acompañado.',
  },
  {
    icono: faClock,
    titulo: 'Disponible 24/7',
    texto: 'Consulta especialidades y agenda cuando mejor te venga.',
  },
  {
    icono: faNotesMedical,
    titulo: 'Historial centralizado',
    texto: 'Tus citas y datos importantes reunidos en un solo lugar.',
  },
  {
    icono: faShieldHalved,
    titulo: 'Privacidad garantizada',
    texto: 'Protegemos tu información con altos estándares de seguridad.',
  },
];

function Logo() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
      <path
        d="M12 7v10M7 12h10"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Landing() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [desplazado, setDesplazado] = useState(false);

  useEffect(() => {
    const alDesplazar = () => setDesplazado(window.scrollY > 12);
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, []);

  useEffect(() => {
    if (!menuAbierto) return undefined;

    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') setMenuAbierto(false);
    };

    window.addEventListener('keydown', alPresionarTecla);
    return () => window.removeEventListener('keydown', alPresionarTecla);
  }, [menuAbierto]);

  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <div className="landing">
      <header className={`landing-navbar${desplazado ? ' landing-navbar--compacta' : ''}`}>
        <div className="landing-contenedor landing-navbar-contenido">
          <a href="#inicio" className="landing-logo" onClick={cerrarMenu}>
            <Logo />
            <span>MediCitas</span>
          </a>

          <nav
            id="landing-menu"
            className={`landing-nav${menuAbierto ? ' landing-nav--abierta' : ''}`}
            aria-label="Navegación principal"
          >
            <a href="#inicio" onClick={cerrarMenu}>Inicio</a>
            <a href="#especialidades" onClick={cerrarMenu}>Especialidades</a>
            <a href="#sobre-nosotros" onClick={cerrarMenu}>Sobre Nosotros</a>

            <div className="landing-nav-acciones landing-nav-acciones--movil">
              <Link to="/login" className="landing-btn landing-btn--fantasma" onClick={cerrarMenu}>
                Iniciar Sesión
              </Link>
              <Link to="/register" className="landing-btn landing-btn--primario" onClick={cerrarMenu}>
                Crear Cuenta
              </Link>
            </div>
          </nav>

          <div className="landing-nav-acciones landing-nav-acciones--escritorio">
            <Link to="/login" className="landing-btn landing-btn--fantasma">Iniciar Sesión</Link>
            <Link to="/register" className="landing-btn landing-btn--primario">Crear Cuenta</Link>
          </div>

          <button
            type="button"
            className="landing-menu-btn"
            aria-expanded={menuAbierto}
            aria-controls="landing-menu"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            <FontAwesomeIcon icon={menuAbierto ? faXmark : faBars} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main>
        <section id="inicio" className="landing-hero">
          <div className="landing-contenedor landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-eyebrow">
                <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
                Tu salud, en buenas manos
              </span>

              <h1>
                Agenda tu cita médica de forma <span>simple y segura</span>
              </h1>

              <p className="landing-hero-descripcion">
                Encuentra especialistas verificados, elige el horario que mejor te
                funciona y gestiona tus citas desde un solo lugar.
              </p>

              <div className="landing-hero-acciones">
                <Link to="/register" className="landing-btn landing-btn--primario landing-btn--grande">
                  Reservar una cita
                  <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                </Link>
                <a href="#especialidades" className="landing-btn landing-btn--suave landing-btn--grande">
                  Ver especialidades
                </a>
              </div>

              <ul className="landing-hero-beneficios">
                <li><FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" /> Confirmación inmediata</li>
                <li><FontAwesomeIcon icon={faShieldHalved} aria-hidden="true" /> Datos protegidos</li>
                <li><FontAwesomeIcon icon={faClock} aria-hidden="true" /> Disponible 24/7</li>
              </ul>
            </div>

            <div className="landing-hero-visual">
              <div className="landing-hero-fondo" aria-hidden="true" />
              <div className="landing-hero-imagen">
                <div className="landing-hero-imagen-respaldo" aria-hidden="true">
                  <FontAwesomeIcon icon={faUserDoctor} />
                </div>
                <img
                  src="/Online-Doctor.png"
                  alt="Ilustración de una médica atendiendo a un paciente en línea"
                  onError={(evento) => { evento.currentTarget.hidden = true; }}
                />
              </div>

              <div className="landing-flotante landing-flotante--cita">
                <span className="landing-flotante-icono" aria-hidden="true">
                  <FontAwesomeIcon icon={faCalendarCheck} />
                </span>
                <div>
                  <strong>Cita confirmada</strong>
                  <span>Hoy · 10:30 a. m.</span>
                </div>
              </div>

              <div className="landing-flotante landing-flotante--medicos">
                <span className="landing-flotante-icono" aria-hidden="true">
                  <FontAwesomeIcon icon={faUserDoctor} />
                </span>
                <div>
                  <strong>Especialistas verificados</strong>
                  <span>Atención de confianza</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-confianza" aria-label="Ventajas de MediCitas">
          <div className="landing-contenedor landing-confianza-grid">
            {beneficios.map((beneficio) => (
              <div className="landing-confianza-item" key={beneficio.titulo}>
                <span className="landing-confianza-icono" aria-hidden="true">
                  <FontAwesomeIcon icon={beneficio.icono} />
                </span>
                <div>
                  <strong>{beneficio.titulo}</strong>
                  <span>{beneficio.texto}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="especialidades" className="landing-seccion landing-especialidades">
          <div className="landing-contenedor">
            <div className="landing-seccion-cabecera">
              <div>
                <span className="landing-eyebrow">Especialidades</span>
                <h2>Especialidades destacadas</h2>
                <p>
                  Encuentra el cuidado que necesitas con especialistas preparados
                  para acompañarte en cada etapa.
                </p>
              </div>
              <Link to="/register" className="landing-enlace">
                Agendar ahora
                <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
              </Link>
            </div>

            <div className="landing-especialidades-grid">
              {especialidades.map((especialidad) => (
                <Link
                  to="/register"
                  className="landing-especialidad"
                  key={especialidad.nombre}
                  aria-label={`Agendar una cita de ${especialidad.nombre}`}
                >
                  <span className="landing-especialidad-icono" aria-hidden="true">
                    <FontAwesomeIcon icon={especialidad.icono} />
                  </span>
                  <h3>{especialidad.nombre}</h3>
                  <p>{especialidad.descripcion}</p>
                  <span className="landing-especialidad-link">
                    Agendar cita
                    <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="sobre-nosotros" className="landing-seccion landing-nosotros">
          <div className="landing-contenedor landing-nosotros-grid">
            <div className="landing-nosotros-visual">
              <div className="landing-nosotros-tarjeta">
                <span className="landing-nosotros-icono" aria-hidden="true">
                  <FontAwesomeIcon icon={faHandHoldingHeart} />
                </span>
                <div>
                  <span className="landing-nosotros-etiqueta">Compromiso MediCitas</span>
                  <h3>Tu bienestar es nuestra prioridad</h3>
                  <p>
                    Creamos una experiencia sencilla para que puedas concentrarte
                    en lo más importante: sentirte bien.
                  </p>
                </div>
                <div className="landing-nosotros-datos">
                  <div><strong>100%</strong><span>En línea</span></div>
                  <div><strong>24/7</strong><span>Disponible</span></div>
                  <div><strong>Seguro</strong><span>Confidencial</span></div>
                </div>
              </div>
              <div className="landing-nosotros-flotante">
                <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
                Citas confirmadas al instante
              </div>
            </div>

            <div className="landing-nosotros-copy">
              <span className="landing-eyebrow">Sobre nosotros</span>
              <h2>Una forma más humana de cuidar tu salud</h2>
              <p>
                MediCitas conecta a pacientes y médicos en una plataforma clara,
                cercana y fácil de usar. Queremos que agendar una consulta sea tan
                sencillo como debería ser.
              </p>

              <div className="landing-valores">
                {valores.map((valor) => (
                  <article className="landing-valor" key={valor.titulo}>
                    <span className="landing-valor-icono" aria-hidden="true">
                      <FontAwesomeIcon icon={valor.icono} />
                    </span>
                    <div>
                      <h4>{valor.titulo}</h4>
                      <p>{valor.texto}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-contenedor landing-cta-contenido">
            <div>
              <h2>¿Listo para agendar tu próxima cita?</h2>
              <p>Da el primer paso hacia una atención más simple y cercana.</p>
            </div>
            <Link to="/register" className="landing-btn landing-btn--blanco landing-btn--grande">
              Crear mi cuenta
              <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-contenedor">
          <div className="landing-footer-grid">
            <div className="landing-footer-marca">
              <a href="#inicio" className="landing-logo landing-logo--footer">
                <Logo />
                <span>MediCitas</span>
              </a>
              <p>
                Una plataforma pensada para acercar la salud a las personas y
                facilitar el encuentro entre pacientes y especialistas.
              </p>
            </div>

            <div className="landing-footer-columna">
              <h3>Plataforma</h3>
              <a href="#inicio">Inicio</a>
              <a href="#especialidades">Especialidades</a>
              <a href="#sobre-nosotros">Sobre nosotros</a>
              <Link to="/login">Iniciar sesión</Link>
            </div>

            <div className="landing-footer-columna">
              <h3>Contacto</h3>
              <a href="mailto:contacto@medicitas.com">
                <FontAwesomeIcon icon={faEnvelope} aria-hidden="true" />
                contacto@medicitas.com
              </a>
              <a href="tel:+525512345678">
                <FontAwesomeIcon icon={faPhone} aria-hidden="true" />
                +52 55 1234 5678
              </a>
              <span className="landing-footer-dato">
                <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
                Ciudad de México, México
              </span>
            </div>
          </div>

          <div className="landing-footer-inferior">
            <p>© 2026 MediCitas. Todos los derechos reservados.</p>
            <div>
              <span>Aviso de privacidad</span>
              <span>Términos de uso</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
