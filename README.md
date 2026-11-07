# MediCitas

Sistema de citas médicas con panel administrativo, portal del paciente y
recordatorios/confirmaciones por Telegram.

- **Backend:** Node.js + Express, arquitectura hexagonal, PostgreSQL.
- **Frontend:** React + Vite, servido como SPA.
- **Automatización:** n8n (Telegram, recordatorios y agente conversacional).
- **Producción:** nginx sirve el SPA y hace proxy de `/api` y `/uploads` al
  backend en el mismo dominio.

## Estructura

```
backend/
  migrations/          SQL versionado (001…008)
  src/
    application/       casos de uso
    domain/            entidades, value objects, reglas
    infrastructure/    PostgreSQL, jobs, migrador
    interfaces/        HTTP, webhooks n8n
  tests/               pruebas de integración (probar-*.sh)
frontend/
  src/                 React
deploy/
  deploy.sh            build + migraciones + copia a nginx + reinicio
  migrar.sh            aplica migraciones pendientes
  nginx/               configuración de nginx
  systemd/             unidad del backend
docs/
  ENDPOINTS.md         contrato de la API
  Reglas_negocio.md    reglas RN-*
```

## Requisitos

- Node.js 20+ (probado con Node 24).
- PostgreSQL 14+.
- n8n (para Telegram y recordatorios). Opcional si solo se usa la web.
- nginx (producción).
- `jq` y `curl` para las pruebas.

## Puesta en marcha (desarrollo)

El orden recomendado es **base de datos → n8n → backend → frontend**.

### 1. Base de datos

```bash
# Crear la base (ajusta usuario/host a tu instalación)
createdb -U postgres citas_medicas

cd backend
cp src/.env.example src/.env
# Edita src/.env: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME y JWT_SECRET
npm ci
npm run db:migrate
npm run db:seed     # crea admin@clinica.com / admin123
```

- `npm run db:migrate` aplica las migraciones pendientes y las registra en
  `schema_migrations`.
- Si la base **ya estaba migrada** antes de existir `schema_migrations`:

  ```bash
  npm run db:migrate -- --baseline
  ```

- Cambia la contraseña del admin después del primer inicio de sesión.

### 2. n8n (Telegram y recordatorios)

1. Importa `MediCitas (2).json` en n8n (**Workflows → Import from File**).
2. Conecta las credenciales:
   - **Telegram** en `Entrada`, `Enviar`, `Enviar error`, `Enviar vinculacion`,
     `Enviar sin vincular` y `Send a text message`.
   - **Groq** o **Google Gemini** en el modelo del `AI Agent` (puedes dejar
     solo el que uses).
3. En los nodos HTTP que llaman al backend (`Obtener token`, `HTTP Request`,
   `Vincular cuenta`, etc.) el header `x-webhook-secret` debe coincidir con
   `N8N_WEBHOOK_SECRET` del backend.
4. Los nodos usan `http://host.docker.internal:4000`. Si n8n corre en Docker y
   el backend en el host, agrega al contenedor:

   ```yaml
   extra_hosts:
     - "host.docker.internal:host-gateway"
   ```

   Si n8n y el backend comparten red/host, puedes usar
   `http://localhost:4000`.
5. **Activa el workflow** para registrar el webhook de producción.
6. En `backend/src/.env` configura:

   ```env
   # Producción (workflow activo)
   N8N_WEBHOOK_URL=https://<tu-n8n>/webhook/recordatorios
   # Mientras pruebas con "Listen for test event" en el editor:
   # N8N_WEBHOOK_URL=https://<tu-n8n>/webhook-test/recordatorios
   N8N_WEBHOOK_SECRET=tu-secreto
   ```

   El backend envía `{ accion, chatId, mensaje, ... }`; el nodo
   `Send a text message` usa `body.chatId` y `body.mensaje`.

> El workflow del repositorio es una plantilla. Las credenciales y los IDs de
> credencial se reconectan al importar; no se versionan secretos.

### 3. Backend

```bash
cd backend
npm run dev      # nodemon
# o
npm start        # node src/server.js
```

Debe escuchar en `http://localhost:4000`. Verifica:

```bash
curl http://localhost:4000/api/health
# {"ok":true,"mensaje":"Servidor activo"}
```

El backend carga `backend/src/.env` con una ruta explícita, así que funciona
tanto con `npm run dev` desde `backend` como con la unidad systemd de
`deploy/`.

### 4. Frontend

```bash
cd frontend
npm ci
npm run dev      # http://localhost:5173
```

En desarrollo no hace falta `VITE_API_URL`: Vite hace proxy de `/api` y
`/uploads` a `http://localhost:4000` (ver `vite.config.js`). Para producción:

```bash
VITE_API_URL= npm run build
# genera frontend/dist con rutas relativas
```

## Despliegue en producción

### Preparación del servidor (una sola vez)

```bash
# 1. Copia el proyecto
sudo mkdir -p /opt/medicitas
sudo rsync -a --exclude node_modules --exclude frontend/dist ./ /opt/medicitas/
sudo useradd --system --home /opt/medicitas --shell /usr/sbin/nologin medicitas
sudo chown -R medicitas:medicitas /opt/medicitas

# 2. Backend: entorno de producción
sudo -u medicitas cp /opt/medicitas/backend/src/.env.example /opt/medicitas/backend/src/.env
sudo -u medicitas nano /opt/medicitas/backend/src/.env
#   NODE_ENV=production
#   JWT_SECRET=<secreto largo y único>
#   ALLOW_TEST_CAPTCHA=false
#   UPLOADS_DIR=/var/lib/medicitas/uploads   (opcional)

# 3. Servicio systemd
sudo cp /opt/medicitas/deploy/systemd/medicitas.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now medicitas

# 4. nginx
sudo cp /opt/medicitas/deploy/nginx/medicitas.conf /etc/nginx/sites-available/medicitas
sudo ln -sf /etc/nginx/sites-available/medicitas /etc/nginx/sites-enabled/medicitas
sudo nginx -t && sudo systemctl reload nginx
```

### Despliegue

```bash
cd /opt/medicitas
bash deploy/deploy.sh
```

El script:

1. instala dependencias del backend (`npm ci --omit=dev`),
2. aplica migraciones pendientes,
3. instala dependencias del frontend y ejecuta `VITE_API_URL= npm run build`,
4. copia `frontend/dist` a `/var/www/medicitas`,
5. reinicia el backend y recarga nginx.

Variables opcionales: `APP_DIR`, `WEB_DIR`, `SERVICE`, `RUN_MIGRATIONS=0`,
`SUDO`. Revisa `deploy/deploy.sh` antes de la primera ejecución.

### Variables de entorno del backend

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del backend (4000 por defecto) |
| `NODE_ENV` | `production` en el servidor |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL |
| `JWT_SECRET` | **Obligatorio**. Firma de tokens |
| `JWT_EXPIRES_IN` | Duración del token (8h por defecto) |
| `APP_TIMEZONE` | Zona de la clínica (`America/Mexico_City`) |
| `UPLOADS_DIR` | Ruta absoluta de uploads (opcional) |
| `TELEGRAM_BOT_TOKEN` | Token del bot (si el backend lo usa directamente) |
| `N8N_WEBHOOK_URL` | Webhook de n8n para recordatorios/mensajes |
| `N8N_WEBHOOK_SECRET` | Secreto compartido con n8n (`x-webhook-secret`) |
| `REMINDERS_ENABLED` | `false` desactiva el scheduler |
| `REMINDERS_INTERVAL_MS` | Intervalo del scheduler (300000 = 5 min) |
| `ALLOW_TEST_CAPTCHA` | `true` solo para pruebas locales |

## Pruebas

Las pruebas crean sus propios datos y los eliminan al terminar.

```bash
# Local: permite captchaId/captchaTexto = "test"
ALLOW_TEST_CAPTCHA=true

# Obtén tokens (ejemplo con el admin sembrado)
ADMIN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@clinica.com","password":"admin123","captchaId":"test","captchaTexto":"test"}' \
  | jq -r '.data.token')

PAC=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<paciente@ejemplo.com>","password":"<password>","captchaId":"test","captchaTexto":"test"}' \
  | jq -r '.data.token')

ADMIN="$ADMIN" PAC="$PAC" bash backend/tests/correr-todo.sh
```

`correr-todo.sh` ejecuta todos los `backend/tests/probar-*.sh` en orden y
muestra el resumen por script. Incluye integración, dashboard, médicos,
pacientes, usuarios, consultorios, especialidades, Telegram y reagendamiento.

## Notas de operación

### Zona horaria

- `APP_TIMEZONE` define la zona de la clínica.
- La API guarda `timestamptz` y devuelve `fecha_hora` en UTC; para n8n/Telegram
  usa `?formato=local` o los campos `hora_local`.
- Las horas de disponibilidad y los recordatorios se calculan en hora local.

### Reagendamiento

- `PUT /api/citas/:id` acepta `{ fecha_hora, medico_id?, consultorio_id? }`.
- El nuevo médico debe estar activo y compartir al menos una especialidad con
  el médico original.
- Al cambiar de médico, el consultorio se toma del hueco elegido.
- `GET /api/citas/:id/propuestas?medico_id=<id>` propone horarios del nuevo
  médico (RN-083).
- La interfaz usa un modal con médico, fecha, sugerencias y horarios libres.

### Recordatorios

- El scheduler del backend envía recordatorios de 24 h y 2 h a n8n.
- Requiere `N8N_WEBHOOK_URL` y el workflow activo.
- Con `N8N_WEBHOOK_URL=.../webhook-test/recordatorios` solo funciona mientras
  el editor de n8n está escuchando; en producción usa `/webhook/recordatorios`.
- `REMINDERS_ENABLED=false` lo desactiva por completo.

### Telegram

- `POST /api/telegram/sesion` (header `x-webhook-secret`) responde
  `{ ok:true, token, vinculado:true }` si el chat ya está vinculado, o
  `{ ok:false, vinculado:false }` si no.
- Vincular es idempotente: si el chat ya está vinculado responde 200
  `"Ya vinculado"`.
- La desvinculación está disponible desde la web y desde n8n.
- Las citas creadas desde n8n (petición con `x-webhook-secret` válido) nacen
  **confirmadas**; las creadas desde la web siguen naciendo **pendientes**.

### Captcha y seguridad

- En producción `ALLOW_TEST_CAPTCHA=false` y `JWT_SECRET` debe ser único.
- Cambia la contraseña del admin sembrado.
- Sirve todo por HTTPS (certbot/nginx) y restringe el acceso a PostgreSQL.
- `backend/uploads` debe ser escribible por el usuario del backend.

## Solución de problemas

| Síntoma | Revisa |
|---------|--------|
| `Falta la variable JWT_SECRET` | `backend/src/.env` y que el proceso arranque desde `backend/src` |
| `ECONNREFUSED` a PostgreSQL | `DB_HOST`/`DB_PORT`, servicio de PostgreSQL y `pg_hba.conf` |
| n8n responde 401 al backend | `x-webhook-secret` en los nodos = `N8N_WEBHOOK_SECRET` |
| n8n no alcanza el backend | `host.docker.internal`, `extra_hosts` o la IP del host |
| Recordatorios no llegan | Workflow activo, `N8N_WEBHOOK_URL` de producción y `chatId` vinculado |
| El SPA da 404 al recargar | `try_files $uri $uri/ /index.html` en nginx |
| Las imágenes no cargan | Proxy `/uploads/` y permisos de `UPLOADS_DIR` |
