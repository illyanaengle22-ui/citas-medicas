# Anexo C: Plantilla de variables de entorno del sistema

A continuación se documentan las variables de entorno requeridas para el funcionamiento del sistema MediCitas en sus distintas capas y servicios. Conforme a las reglas de seguridad, **no se incluyen contraseñas, secretos, tokens ni valores confidenciales reales**.

## 1. Variables de entorno del Backend (`backend/.env`)

Tabla 25. Variables de entorno del servidor de aplicaciones Node.js / Express.

| Variable | Tipo de dato | Descripción y propósito en el sistema | Valor referencial por defecto |
|---|---|---|---|
| `PORT` | Numérico | Puerto TCP en el que escucha el servidor Express. | `4000` |
| `NODE_ENV` | Cadena | Entorno de ejecución (`development` o `production`). | `production` |
| `ALLOW_TEST_CAPTCHA` | Booleano | Si es `true`, permite resolver captchas con valores fijos en pruebas. | `false` |
| `TZ` | Cadena | Huso horario del proceso para cálculos de fechas locales. | `America/Mexico_City` |
| `APP_TIMEZONE` | Cadena | Zona horaria de referencia para la clínica y visualización de citas. | `America/Mexico_City` |
| `DB_HOST` | Cadena / IP | Dirección IP privada de la instancia de base de datos PostgreSQL. | `IP_PRIVADA_BD` |
| `DB_PORT` | Numérico | Puerto de escucha de la base de datos PostgreSQL. | `5432` |
| `DB_USER` | Cadena | Nombre del usuario de la base de datos. | `citas_user` |
| `DB_PASSWORD` | Secreto | Contraseña asignada al usuario de la base de datos. | `[DEFINIDO_EN_DESPLIEGUE]` |
| `DB_NAME` | Cadena | Nombre de la base de datos relacional. | `citas_medicas` |
| `JWT_SECRET` | Secreto | Clave criptográfica para la firma de tokens de autenticación JWT. | `[DEFINIDO_EN_DESPLIEGUE]` |
| `JWT_EXPIRES_IN` | Cadena | Tiempo de vigencia de los tokens de sesión de usuarios. | `8h` |
| `CAPTCHA_TTL_MS` | Numérico | Tiempo de vida de los captchas visuales en milisegundos. | `300000` (5 minutos) |
| `UPLOADS_DIR` | Ruta | Ruta absoluta en disco para el almacenamiento de archivos e imágenes. | `/ruta/absoluta/uploads` |
| `N8N_WEBHOOK_URL` | URL | URL del webhook de n8n para el despacho interno de recordatorios. | `http://IP_PRIVADA_N8N:5678/webhook/recordatorios` |
| `N8N_WEBHOOK_SECRET` | Secreto | Clave compartida para autenticar solicitudes entre n8n y el backend. | `[DEFINIDO_EN_DESPLIEGUE]` |
| `REMINDERS_ENABLED` | Booleano | Habilita o deshabilita la ejecución del scheduler de recordatorios. | `true` |
| `REMINDERS_INTERVAL_MS`| Numérico | Intervalo de ejecución de la tarea periódica de recordatorios. | `300000` (5 minutos) |

---

## 2. Variables de entorno del subsistema de automatización (`deploy-n8n.sh`)

Tabla 26. Variables de entorno para n8n, Docker y el túnel de comunicación.

| Variable | Tipo de dato | Descripción y propósito en el sistema | Valor referencial por defecto |
|---|---|---|---|
| `N8N_HOST` | Cadena / IP | Interfaz de enlace de n8n dentro del contenedor Docker. | `0.0.0.0` |
| `N8N_PORT` | Numérico | Puerto interno de escucha de la interfaz web y webhooks de n8n. | `5678` |
| `N8N_PROTOCOL` | Cadena | Protocolo de red interno para la interfaz de n8n. | `http` |
| `WEBHOOK_URL` | URL | URL pública HTTPS generada por ngrok para la entrega de webhooks. | `https://DOMINIO_NGROK_TUNNEL/` |
| `N8N_ENCRYPTION_KEY` | Secreto | Clave maestra para el cifrado interno de credenciales en n8n. | `[CLAVE_HEXADECIMAL_32B]` |
| `GENERIC_TIMEZONE` | Cadena | Zona horaria de referencia para la ejecución de flujos de n8n. | `America/Mexico_City` |
| `TZ` | Cadena | Variable de sistema para la zona horaria de los contenedores Docker. | `America/Mexico_City` |
| `N8N_SECURE_COOKIE` | Booleano | Control de cookies seguras (desactivado si se accede vía proxy HTTP). | `false` |
| `N8N_DIAGNOSTICS_ENABLED`| Booleano | Habilita o deshabilita el envío de telemetría a los servidores de n8n. | `false` |
| `EXECUTIONS_DATA_PRUNE` | Booleano | Activa la purga automática de bitácoras de ejecuciones antiguas. | `true` |
| `EXECUTIONS_DATA_MAX_AGE`| Numérico | Antigüedad máxima en horas de los datos de ejecuciones conservados. | `168` (7 días) |
| `TELEGRAM_BOT_TOKEN` | Secreto | Token de autenticación del bot de Telegram emitido por BotFather. | `[TOKEN_BOT_TELEGRAM]` |
| `GROQ_API_KEY` | Secreto | Clave de acceso a la API de inferencia de modelos LLM en Groq. | `[API_KEY_GROQ]` |
| `GEMINI_API_KEY` | Secreto | Clave de acceso a la API de modelos Google Gemini (opcional). | `[API_KEY_GEMINI]` |
| `NGROK_AUTHTOKEN` | Secreto | Token de autenticación para el túnel de red de la cuenta ngrok. | `[TOKEN_NGROK]` |
| `NGROK_DOMAIN` | Cadena | Dominio o subdominio estático reservado en ngrok para el túnel. | `DOMINIO_ESTATICO_NGROK` |

---

## 3. Variables de entorno del script de Base de Datos (`deploy-db.sh`)

Tabla 27. Variables de configuración del script de aprovisionamiento de PostgreSQL.

| Variable | Tipo de dato | Descripción y propósito en el sistema | Valor referencial por defecto |
|---|---|---|---|
| `DB_NAME` | Cadena | Nombre de la base de datos a inicializar. | `citas_medicas` |
| `DB_USER` | Cadena | Nombre de usuario con privilegios de aplicación a crear. | `citas_user` |
| `DB_PASSWORD` | Secreto | Contraseña asignada al usuario de base de datos. | `[DEFINIDO_EN_DESPLIEGUE]` |
| `ADMIN_PASSWORD` | Secreto | Contraseña asignada a la cuenta inicial de administrador. | `[DEFINIDO_EN_DESPLIEGUE]` |
| `CARGAR_DEMO` | Numérico | Si es `1`, inserta datos semilla de demostración en la base de datos. | `0` |
