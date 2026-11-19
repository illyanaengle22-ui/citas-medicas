# Despliegue paso a paso en AWS

El despliegue de MediCitas se automatizó en dos fases: compilación y publicación de ramas huérfanas desde el entorno local, y aprovisionamiento secuencial desatendido en las cuatro instancias EC2.

La Figura 6 esquematiza el flujo continuo de compilación y entrega por ramas.

![Figura 6. Flujo del proceso de compilación y despliegue por ramas.](img/flujo-despliegue-ramas.png)

## Fase 1: Compilación y publicación (`build-y-publicar.sh`)

1. **Clonación limpia en `/tmp`:** Para evitar bloqueos de archivos en sistemas DrvFs (WSL), el script clona el repositorio en un directorio ext4 nativo.
2. **Empaquetado de Backend:** Ejecuta `esbuild src/server.js --bundle --platform=node --target=node22 --packages=external --outfile=dist/server.js`.
3. **Compilación de Frontend:** Genera los activos estáticos minificados en `frontend/dist/` mediante `npm run build`.
4. **Publicación por ramas huérfanas:** Crea las ramas `deploy/db`, `deploy/back`, `deploy/front` y `deploy/n8n`, enviándolas con `git push -f origin <rama>`.

## Fase 2: Orden secuencial de despliegue en AWS

### Paso 1: Base de Datos (`EC2-BD`)

Descarga la rama `deploy/db` y aprovisiona PostgreSQL:

```bash
git clone -b deploy/db https://github.com/REPO_USUARIO/citas-medicas.git app && cd app
DB_PASSWORD='SECRETO_DB' ADMIN_PASSWORD='SECRETO_ADMIN' CARGAR_DEMO=1 bash deploy/deploy-db.sh
```

El script configura `postgresql.conf` (`listen_addresses='*'`), autoriza la subred en `pg_hba.conf`, habilita las extensiones `pgcrypto`, `citext`, `btree_gist`, corre las 8 migraciones, crea el admin inicial y concede permisos completos a `citas_user`.

### Paso 2: Motor de automatización (`EC2-N8N`)

Descarga la rama `deploy/n8n` y lanza los contenedores:

```bash
git clone -b deploy/n8n https://github.com/REPO_USUARIO/citas-medicas.git app && cd app
export N8N_ENCRYPTION_KEY='CLAVE' N8N_WEBHOOK_SECRET='SECRETO' TELEGRAM_BOT_TOKEN='TOKEN' GROQ_API_KEY='KEY' NGROK_AUTHTOKEN='TOKEN'
bash deploy/deploy-n8n.sh IP_PRIVADA_BACK
```

Instala Docker, levanta n8n (v2.43.7) y ngrok, importa credenciales, carga `MediCitas.json` y activa el flujo mediante `n8n publish:workflow --id=GLIxoBsZqn5Tb9bT --active=true`.

### Paso 3: Backend API (`EC2-BACK`)

Descarga la rama `deploy/back` e inicia la aplicación supervisada por PM2:

```bash
git clone -b deploy/back https://github.com/REPO_USUARIO/citas-medicas.git app && cd app
export DB_PASSWORD='SECRETO_DB' JWT_SECRET='SECRETO_JWT' N8N_WEBHOOK_SECRET='SECRETO'
bash deploy/deploy-back.sh IP_PRIVADA_BD IP_PRIVADA_N8N
```

Instala Node.js 22 LTS, PM2, dependencias de producción (`npm install --omit=dev`), crea carpetas de uploads, genera `.env` con `TZ=America/Mexico_City`, arranca `dist/server.js` con PM2 y valida `/api/health`.

### Paso 4: Frontend Web (`EC2-FRONT`)

Descarga la rama `deploy/front` y configura Nginx:

```bash
git clone -b deploy/front https://github.com/REPO_USUARIO/citas-medicas.git app && cd app
bash deploy/deploy-front.sh IP_PRIVADA_BACK
```

Instala Nginx, copia los archivos estáticos a `/var/www/app`, sustituye `__BACKEND_IP__` en la configuración del proxy inverso, valida la sintaxis con `nginx -t` y reinicia el servicio.
