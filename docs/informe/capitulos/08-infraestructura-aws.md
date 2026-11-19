# Infraestructura en Amazon Web Services (AWS)

MediCitas se desplegó en **Amazon Web Services (AWS)** en la región `us-east-1` utilizando cuatro instancias **Amazon EC2** aisladas por responsabilidad y protegidas por Grupos de Seguridad bajo el principio de mínimo privilegio.

La Figura 5 detalla la topología de red, instancias, puertos y flujos de tráfico autorizados.

![Figura 5. Arquitectura de despliegue en Amazon Web Services (AWS).](img/infraestructura-aws.png)

## Justificación de la arquitectura de 4 instancias frente a 2

El Taller 3 contemplaba inicialmente dos instancias virtuales. Para MediCitas se implementaron **cuatro instancias dedicadas** por las siguientes razones:

1. **Aislamiento de n8n y Docker:** n8n y ngrok demandan recursos computacionales significativos y un volumen de 30 GB EBS para dependencias y bitácoras; su aislamiento previene degradaciones sobre la API transaccional.
2. **Defensa en profundidad para PostgreSQL:** La instancia `EC2-BD` no se expone a Internet; su puerto 5432 solo admite conexiones TCP procedentes de la IP privada de `EC2-BACK`.
3. **Desacoplamiento web y aplicativo:** Separar Nginx (`EC2-FRONT`) de Node.js (`EC2-BACK`) permite la entrega eficiente de activos estáticos y terminación TLS sin competir por CPU con el procesamiento de peticiones.
4. **Independencia de despliegues:** El uso de cuatro ramas huérfanas compiladas (`deploy/db`, `deploy/back`, `deploy/front`, `deploy/n8n`) permite actualizar cada capa sin reiniciar componentes no afectados.

## Características de las instancias EC2

En la Tabla 19 se desglosan las especificaciones de las instancias aprovisionadas.

Tabla 19. Especificaciones de las instancias Amazon EC2 desplegadas en AWS.

| Identificador lógico | Tipo de instancia | Sistema Operativo | Almacenamiento EBS | Software principal alojado |
|---|---|---|---|---|
| **EC2-FRONT** | `t3.micro` | Ubuntu 24.04 LTS | 8 GB gp3 | Nginx 1.24+, SPA React compilada en `/var/www/app` |
| **EC2-BACK** | `t3.micro` | Ubuntu 24.04 LTS | 8 GB gp3 | Node.js 22 LTS, PM2, API Express en puerto 4000 |
| **EC2-BD** | `t3.micro` | Ubuntu 24.04 LTS | 8 GB gp3 | PostgreSQL 14+, extensiones pgcrypto, citext, btree_gist |
| **EC2-N8N** | `t3.medium` | Ubuntu 24.04 LTS | 30 GB gp3 | Docker, n8n v2.43.7, túnel ngrok, puerto 5678 |

## Grupos de Seguridad (Security Groups)

La Tabla 20 resume las reglas de entrada implementadas para restringir accesos por capas.

Tabla 20. Configuración de Grupos de Seguridad en AWS.

| Security Group | Puerto / Protocolo | Origen permitido | Propósito y justificación |
|---|---|---|---|
| `sg-citas-front` | 80 / TCP (HTTP) | `0.0.0.0/0` | Tráfico web público de pacientes y administradores. |
| `sg-citas-front` | 443 / TCP (HTTPS)| `0.0.0.0/0` | Tráfico web seguro cifrado con TLS/SSL. |
| `sg-citas-front` | 22 / TCP (SSH) | IP del administrador | Acceso administrativo a terminal mediante clave privada. |
| `sg-citas-back` | 4000 / TCP | `sg-citas-front` | Peticiones API originadas desde el proxy Nginx. |
| `sg-citas-back` | 4000 / TCP | `sg-citas-n8n` | Herramientas HTTP ejecutadas por el agente de n8n. |
| `sg-citas-back` | 22 / TCP (SSH) | IP del administrador | Gestión remota de la instancia. |
| `sg-citas-bd` | 5432 / TCP | `sg-citas-back` | Conexiones de base de datos exclusivas desde la API backend. |
| `sg-citas-bd` | 22 / TCP (SSH) | IP del administrador | Gestión remota y ejecución de migraciones. |
| `sg-citas-n8n` | 5678 / TCP | `sg-citas-back` | Disparo del webhook interno de recordatorios de citas. |
| `sg-citas-n8n` | 22 / TCP (SSH) | IP del administrador | Gestión del demonio Docker y actualización de flujos. |

## Ramas de despliegue huérfanas (*Orphan Branches*)

El script `deploy/build-y-publicar.sh` compila en local y publica cuatro ramas desvinculadas del historial de desarrollo:
* `deploy/db`: Contiene migraciones SQL y `deploy/deploy-db.sh`.
* `deploy/back`: Contiene el bundle `dist/server.js`, `package.json` de producción y `deploy/deploy-back.sh`.
* `deploy/front`: Contiene activos compilados en `dist/`, plantilla de Nginx y `deploy/deploy-front.sh`.
* `deploy/n8n`: Contiene `docker-compose.yml`, `MediCitas.json` y `deploy/deploy-n8n.sh`.
