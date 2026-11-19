# Problemas encontrados y soluciones aplicadas

Durante el desarrollo, empaquetado, migración y despliegue en AWS, se superaron diversos desafíos técnicos que se documentan a continuación con su causa raíz y solución aplicada.

## 1. Resolución de dependencias nativas en esbuild
* **Problema:** El empaquetado del backend fallaba al intentar resolver librerías con módulos en C/C++ nativos como `pg` o `dotenv`.
* **Causa:** `esbuild` intentaba incluir todas las dependencias estáticamente dentro del bundle `dist/server.js`.
* **Solución:** Se añadió la bandera `--packages=external` al script de compilación para que las dependencias de terceros se resuelvan en tiempo de ejecución desde `node_modules` (`npm install --omit=dev`).

## 2. Bloqueo de archivos en WSL/Windows (DrvFs)
* **Problema:** El script de compilación fallaba al limpiar directorios temporales con errores `Device or resource busy`.
* **Causa:** El sistema de archivos Windows montado en WSL (`/mnt/c/...`) sufría bloqueos por indexadores y antivirus del host.
* **Solución:** Se modificó `deploy/build-y-publicar.sh` para clonar y compilar en un directorio temporal bajo el sistema de archivos nativo ext4 (`/tmp/citas-build-XXXXXX`).

## 3. Fallo HTTP 408 en `git push` de ramas compiladas
* **Problema:** El envío de la rama `deploy/front` hacia GitHub fallaba por tiempo de espera agotado (*timeout*).
* **Causa:** Los artefactos compilados del frontend superaban el buffer de transferencia HTTP configurado en Git.
* **Solución:** Se incrementó el buffer del cliente Git a 500 MB ejecutando `git config http.postBuffer 524288000`.

## 4. Denegación de permisos sobre tablas en PostgreSQL
* **Problema:** Tras ejecutar migraciones en `EC2-BD`, las peticiones del backend fallaban con `permission denied for table usuarios`.
* **Causa:** Los objetos se crearon con el superusuario `postgres`, omitiendo permisos para el usuario aplicativo `citas_user`.
* **Solución:** Se añadió un bloque explícito de concesión masiva de privilegios (`GRANT ALL PRIVILEGES ON ALL TABLES/SEQUENCES...`) al final de `deploy/deploy-db.sh`.

## 5. Bloqueo de lectura de migraciones por permisos en Linux
* **Problema:** Al ejecutar `psql -f` sobre scripts de migración, PostgreSQL arrojaba `Permission denied`.
* **Causa:** El directorio `/home/ubuntu` tenía permisos restrictivos `700`, inaccesibles para el usuario `postgres`.
* **Solución:** Se utilizó redirección de entrada estándar (`sudo -u postgres psql -d citas_medicas < "$mig"`) y permisos `chmod 755 /home/ubuntu`.

## 6. Variables de entorno bloqueadas en `.env`
* **Problema:** PM2 arrancaba el servidor pero reportaba variables de base de datos indefinidas (`undefined`).
* **Causa:** El archivo `.env` fue generado con `sudo`, quedando como propietario `root` con permisos `600`, ilegible para el usuario `ubuntu`.
* **Solución:** Se ajustó `deploy/deploy-back.sh` para crear `.env` bajo el usuario `ubuntu` con permisos de lectura `chmod 644`.

## 7. Conflicto de demonios de PM2 (Root vs Ubuntu)
* **Problema:** `pm2 status` mostraba cero procesos pero el puerto 4000 estaba ocupado con error `EADDRINUSE`.
* **Causa:** Se había ejecutado `sudo pm2 start`, creando un demonio bajo root invisible para la sesión de ubuntu.
* **Solución:** Se terminó el demonio de root con `sudo pm2 kill` y se arrancó exclusivamente bajo el usuario `ubuntu`.

## 8. Agotamiento de almacenamiento en `EC2-N8N`
* **Problema:** `docker compose up -d` se interrumpía con `no space left on device`.
* **Causa:** El volumen inicial de 20 GB se saturó con imágenes de Docker, dependencias y bitácoras de n8n.
* **Solución:** Se aumentó el disco a 30 GB EBS gp3 y se habilitó la purga automática de datos (`EXECUTIONS_DATA_PRUNE=true`).

## 9. Fallo en comando de publicación de n8n v2
* **Problema:** La instrucción `n8n publish:workflow --all` fallaba con error de sintaxis en terminal.
* **Causa:** n8n v2.43.7 eliminó la bandera `--all`, exigiendo el identificador explícito del flujo.
* **Solución:** Se modificó `deploy/deploy-n8n.sh` para usar `n8n publish:workflow --id=GLIxoBsZqn5Tb9bT --active=true`.

## 10. Desfase de zona horaria en validación RN-072
* **Problema:** La API rechazaba citas dentro de jornada indicando que caían fuera del horario del médico.
* **Causa:** Los servidores de AWS operan en UTC, interpretando fechas enviadas en hora local de México como el día posterior.
* **Solución:** Se fijó `TZ=America/Mexico_City` en `.env` y se normalizaron las fechas entrantes con la función `normalizarFechaEntrada()`.

## 11. Error 404 en fotografías de perfil
* **Problema:** Las imágenes de médicos y perfiles no cargaban en el frontend.
* **Causa:** Rutas relativas en Multer incompatibles con el directorio de trabajo de PM2 y ausencia de ruta `/uploads/` en Nginx.
* **Solución:** Se centralizó `config/uploads.js` con rutas absolutas y se añadió la directiva `location /uploads/` en Nginx.

## 12. Excepción `useState is not defined` en Topbar
* **Problema:** La interfaz web colapsaba con pantalla en blanco al desplegar el menú de usuario.
* **Causa:** Omisión del import del hook `useState` en la cabecera de `Topbar.jsx`.
* **Solución:** Se añadió la importación explícita `import { useState } from 'react';`.

## 13. Superposición visual de insignia en `MedicoCard`
* **Problema:** La etiqueta "Seleccionado" se encimaba sobre el nombre del médico en el asistente de agendamiento.
* **Causa:** Posicionamiento absoluto sin flujo flexible en pantallas compactas en `MedicoCard.css`.
* **Solución:** Se reestructuró el contenedor con flexbox vertical y márgenes relativos limpios.

## 14. Nombre de bot inconsistente en pantalla de vinculación
* **Problema:** Los pacientes intentaban vincularse con un nombre de bot genérico inexistente.
* **Causa:** Texto estático desactualizado en la vista `VincularTelegram.jsx`.
* **Solución:** Se actualizó la referencia en el componente para dirigir hacia `@medicitasAppBot`.
