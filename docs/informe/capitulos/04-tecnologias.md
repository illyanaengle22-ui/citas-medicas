# Tecnologías utilizadas

El sistema MediCitas utiliza una arquitectura desacoplada basada en tecnologías modernas que garantizan rendimiento, integridad relacional y modularidad. En la Tabla 13 y la Tabla 14 se detallan las versiones exactas verificadas en los archivos de configuración.

## Pila tecnológica del backend

El servidor opera sobre **Node.js 22 LTS** con el framework **Express 5**, utilizando el cliente nativo de PostgreSQL (`pg`) con consultas SQL directas optimizadas para control transaccional estricto.

Tabla 13. Tecnologías y bibliotecas del backend.

| Tecnología / Paquete | Versión declarada | Propósito y justificación en el sistema |
|---|---|---|
| **Node.js** | v22.x LTS | Entorno de ejecución en servidor para JavaScript de alto rendimiento. |
| **Express** | `^5.2.1` | Marco web minimalista para la exposición y enrutamiento de la API REST. |
| **pg** (*node-postgres*) | `^8.23.1` | Controlador de conexión directa y cliente de agrupación (*pooling*) a PostgreSQL. |
| **bcryptjs** | `^3.0.3` | Implementación pura de bcrypt para hashing y contraste seguro de contraseñas. |
| **jsonwebtoken** | `^9.0.3` | Generación, firmado criptográfico y validación de tokens de sesión JWT. |
| **svg-captcha** | `^1.4.0` | Generador de captchas visuales en formato vectorial SVG para protección contra bots. |
| **multer** | `^2.4.0` | Middleware para gestión de solicitudes multipart/form-data y subida de imágenes. |
| **dotenv** | `^18.0.5` | Carga segura de variables de entorno desde archivos locales hacia `process.env`. |
| **cors** | `^2.8.6` | Configuración de políticas de intercambio de recursos de origen cruzado (CORS). |
| **esbuild** | `^0.25.0` | Empaquetador ultrarrápido para generar el bundle único de producción `dist/server.js`. |
| **nodemon** | `^3.1.14` | Monitorización y reinicio automático del servidor en entorno de desarrollo. |
| **node-pg-migrate**| `^9.0.0` | Herramienta de gestión estructurada de migraciones de esquemas en PostgreSQL. |

## Pila tecnológica del frontend

La interfaz web es una aplicación de página única (*SPA*) construida con **React 19** y compilada con **Vite 8**, complementada con bibliotecas especializadas para gráficos analíticos y calendario médico.

Tabla 14. Tecnologías y bibliotecas del frontend.

| Tecnología / Paquete | Versión declarada | Propósito y justificación en el sistema |
|---|---|---|
| **React** | `^19.2.8` | Biblioteca declarativa para la construcción de interfaces de usuario basadas en componentes. |
| **React DOM** | `^19.2.8` | Adaptador del núcleo de React para renderizado eficiente en el DOM del navegador. |
| **React Router DOM** | `^7.18.4` | Enrutador declarativo para navegación cliente y protección de rutas privadas por rol. |
| **Vite** | `^8.3.0` | Entorno de desarrollo rápido y empaquetador de módulos optimizado para producción. |
| **Recharts** | `^3.10.1` | Biblioteca de gráficos analíticos componibles basados en SVG para los tableros analíticos. |
| **@fullcalendar/react** | `^6.1.22` | Componente de calendario interactivo para la gestión visual de citas de médicos y administradores. |
| **@fullcalendar/daygrid** | `^6.1.22` | Vista mensual y cuadrícula de días para el componente de calendario. |
| **@fullcalendar/timegrid**| `^6.1.22` | Vista semanal y diaria con franjas horarias para la visualización de huecos de atención. |
| **@fortawesome/react-fontawesome** | `^3.5.0` | Integración de iconografía vectorial FontAwesome en componentes React. |
| **oxlint** | `^1.81.0` | Linter estático de código JavaScript/React de alto rendimiento escrito en Rust. |

## Motor de base de datos, automatización y servicios

* **PostgreSQL 14+:** Motor relacional con extensiones `pgcrypto` (`gen_random_uuid()`), `citext` (correos case-insensitive) y `btree_gist` (índices GiST para restricciones `EXCLUDE`).
* **n8n (v2.43.7):** Orquestador de automatizaciones desplegado en Docker que conecta Telegram con la API REST.
* **ngrok:** Túnel seguro que expone el puerto de n8n para la recepción de webhooks de Telegram.
* **PM2:** Administrador de procesos en producción para Node.js configurado en modo fork.
* **Nginx 1.24+:** Servidor web y proxy inverso para despachar la SPA estática y redirigir `/api/` y `/uploads/` al backend.
