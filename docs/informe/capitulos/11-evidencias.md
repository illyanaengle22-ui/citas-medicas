# Evidencias de funcionamiento y despliegue

A continuación se presenta el catálogo de evidencias que certifican la implementación, operatividad y despliegue del sistema MediCitas en Amazon Web Services (AWS), cubriendo los requerimientos del Taller 3.

---

### Captura 1: Inicio de sesión con validación de Captcha visual
![Captura 1: Inicio de sesión con validación de Captcha visual](img/01-login-captcha.png)
**Qué muestra:** Demuestra la protección contra accesos automatizados mediante captchas SVG efímeros (RN-020 a RN-023).
**Qué observar:** Formulario de credenciales, imagen vectorial del captcha con ruido y campo de verificación.

---

### Captura 2: Tablero analítico del Administrador con indicadores y gráficos
![Captura 2: Tablero analítico del Administrador con indicadores y gráficos](img/02-dashboard-admin.png)
**Qué muestra:** Presenta los indicadores cuantitativos de citas, facultativos y ocupación calculados en PostgreSQL.
**Qué observar:** Tarjetas con conteos consolidados y gráficos cronológicos de distribución de consultas por día y estado.

---

### Captura 3: Administración y aprobación de usuarios
![Captura 3: Administración y aprobación de usuarios](img/03-crud-usuarios.png)
**Qué muestra:** Evidencia la consola para aprobar o rechazar cuentas en estado pendiente y gestionar roles (RN-003 a RN-005).
**Qué observar:** Listado con estados de cuenta y botones contextuales para aprobación, cambio de rol o baja lógica.

---

### Captura 4: Administración del catálogo de especialidades médicas
![Captura 4: Administración del catálogo de especialidades médicas](img/04-crud-especialidades.png)
**Qué muestra:** Certifica el mantenimiento de especialidades médicas con nombres únicos y activación lógica (RN-030 a RN-034).
**Qué observar:** Catálogo de disciplinas clínicas, estado activo/inactivo y modal para alta o modificación.

---

### Captura 5: Gestión de consultorios físicos
![Captura 5: Gestión de consultorios físicos](img/05-crud-consultorios.png)
**Qué muestra:** Acredita la gestión de espacios físicos de consulta y su borrado lógico seguro (RN-032 a RN-034).
**Qué observar:** Nombres de consultorios, ubicaciones físicas, teléfonos y opciones de edición o inactivación.

---

### Captura 6: Registro transaccional y catálogo de médicos
![Captura 6: Registro transaccional y catálogo de médicos](img/06-crud-medicos.png)
**Qué muestra:** Demuestra el alta atómica de médicos vinculando usuario, cédula, especialidades y consultorios (RN-040 a RN-047).
**Qué observar:** Fichas profesionales con cédula visible para admin, especialidades acreditadas y sedes autorizadas.

---

### Captura 7: Proceso de agendamiento de cita como paciente
![Captura 7: Proceso de agendamiento de cita como paciente](img/07-agendar-cita-paciente.png)
**Qué muestra:** Ilustra la reserva guiada de consultas mediante el cálculo dinámico de huecos libres (RN-065 y RN-070 a RN-073).
**Qué observar:** Selectores de especialidad, facultativo, fecha en calendario y cuadrícula horaria de turnos disponibles.

---

### Captura 8: Detección y rechazo de doble agendamiento (Restricción GiST)
![Captura 8: Detección y rechazo de doble agendamiento (Restricción GiST)](img/08-rechazo-doble-agendamiento.png)
**Qué muestra:** Constata la captura del error 23P01 de PostgreSQL ante colisiones temporales concurrentes (RN-074 y RN-075).
**Qué observar:** Mensaje de error 409 amigable impidiendo la reserva duplicada en el mismo intervalo.

---

### Captura 9: Visualización de citas en agenda y calendario
![Captura 9: Visualización de citas en agenda y calendario](img/09-agenda-calendario.png)
**Qué muestra:** Exhibe la agenda médica en cuadrícula interactiva y el control asistencial por consulta (RN-082).
**Qué observar:** Eventos clasificados por color según estado y opciones para asentar asistencia del paciente.

---

### Captura 10: Flujo de trabajo activo en la interfaz de n8n
![Captura 10: Flujo de trabajo activo en la interfaz de n8n](img/10-n8n-workflow-activo.png)
**Qué muestra:** Acredita el flujo integral de automatización con sus dos disparadores, agente IA y 13 herramientas HTTP.
**Qué observar:** Topología completa de nodos conectados y el indicador superior en estado activo.

---

### Captura 11: Conversación interactiva con el bot de Telegram
![Captura 11: Conversación interactiva con el bot de Telegram](img/11-telegram-chatbot.png)
**Qué muestra:** Demuestra la vinculación por comando `/start <codigo>` y la gestión conversacional de citas con IA (RN-116).
**Qué observar:** Mensajes de confirmación de enlace de cuenta y respuestas del bot consultando o reservando citas.

---

### Captura 12: Recordatorio preventivo recibido en Telegram con botones de acción
![Captura 12: Recordatorio preventivo recibido en Telegram con botones de acción](img/12-telegram-recordatorio.png)
**Qué muestra:** Comprueba el despacho autónomo de alertas preventivas programadas con botones interactivos (RN-100 a RN-104).
**Qué observar:** Detalle de la cita médica y botones "Confirmar", "Cancelar" y "Reagendar" al pie del mensaje.

---

### Captura 13: Panel de instancias Amazon EC2 en la consola de AWS
![Captura 13: Panel de instancias Amazon EC2 en la consola de AWS](img/13-aws-consolas-ec2.png)
**Qué muestra:** Certifica el despliegue de las cuatro máquinas virtuales aisladas en la infraestructura cloud de AWS.
**Qué observar:** Instancias `EC2-FRONT`, `EC2-BACK`, `EC2-BD` y `EC2-N8N` activas con comprobaciones de estado aprobadas.

---

### Captura 14: Configuración de Grupos de Seguridad (Security Groups) en AWS
![Captura 14: Configuración de Grupos de Seguridad (Security Groups) en AWS](img/14-aws-security-groups.png)
**Qué muestra:** Evidencia la aplicación del principio de mínimo privilegio restringiendo puertos entre capas.
**Qué observar:** Reglas entrantes donde la base de datos y n8n solo reciben tráfico autorizado desde el backend.

---

### Captura 15: Tablas y extensiones en PostgreSQL (Terminal EC2-BD)
![Captura 15: Tablas y extensiones en PostgreSQL (Terminal EC2-BD)](img/15-terminal-psql-dt.png)
**Qué muestra:** Constata la correcta aplicación de las migraciones creando las 15 tablas y las 3 extensiones nativas.
**Qué observar:** Esquema público con tablas transaccionales y presencia de `pgcrypto`, `citext` y `btree_gist`.

---

### Captura 16: Estado de procesos en PM2 (Terminal EC2-BACK)
![Captura 16: Estado de procesos en PM2 (Terminal EC2-BACK)](img/16-terminal-pm2-status.png)
**Qué muestra:** Verifica la ejecución supervisada y estable del servidor backend bajo el gestor PM2.
**Qué observar:** Proceso `api` en modo `fork`, estado `online`, uso controlado de memoria y cero reinicios.

---

### Captura 17: Contenedores Docker activos en EC2-N8N
![Captura 17: Contenedores Docker activos en EC2-N8N](img/17-terminal-docker-ps.png)
**Qué muestra:** Certifica la ejecución simultánea y saludable de los contenedores de n8n y del túnel ngrok.
**Qué observar:** Contenedores `n8n` (puerto 5678) y `ngrok_tunnel` en estado activo e interconectados.

---

### Captura 18: Verificación sintáctica y estado de Nginx (Terminal EC2-FRONT)
![Captura 18: Verificación sintáctica y estado de Nginx (Terminal EC2-FRONT)](img/18-terminal-nginx-status.png)
**Qué muestra:** Constata la correcta sintaxis y ejecución del proxy inverso web en la instancia de frontend.
**Qué observar:** Respuesta `syntax is ok` y estado `active (running)` del servicio del servidor web.

---

### Captura 19: Aplicación web operativa en el navegador desde la IP pública
![Captura 19: Aplicación web operativa en el navegador desde la IP pública](img/19-app-ip-publica-navegador.png)
**Qué muestra:** Certifica la entrega pública completa de la solución a usuarios finales a través de Internet.
**Qué observar:** Barra de direcciones con la IP pública del frontend y la interfaz gráfica plenamente operativa.

---

## Matriz y guía para la recolección de evidencias

En la Tabla 23 se resume el catálogo consolidado de evidencias requeridas para el informe técnico.

Tabla 23. Catálogo de evidencias y capturas requeridas para el informe técnico.

| Número | Nombre de archivo sugerido | Descripción de la captura | Prioridad |
|:---:|---|---|:---:|
| 1 | `01-login-captcha.png` | Formulario de login con captcha visual | Alta |
| 2 | `02-dashboard-admin.png` | Dashboard de admin con métricas y gráficas Recharts | Alta |
| 3 | `03-crud-usuarios.png` | Gestión de usuarios y aprobación de cuentas | Media |
| 4 | `04-crud-especialidades.png` | Listado y modal de especialidades médicas | Media |
| 5 | `05-crud-consultorios.png` | Catálogo de consultorios físicos | Media |
| 6 | `06-crud-medicos.png` | Fichas médicas con especialidades y consultorios | Alta |
| 7 | `07-agendar-cita-paciente.png` | Asistente de agendamiento con cálculo de huecos | Alta |
| 8 | `08-rechazo-doble-agendamiento.png` | Mensaje de rechazo 409 por restricción GiST | Crítica |
| 9 | `09-agenda-calendario.png` | Agenda médica o calendario interactivo | Alta |
| 10 | `10-n8n-workflow-activo.png` | Flujo de n8n activo con sus 31 nodos | Crítica |
| 11 | `11-telegram-chatbot.png` | Chat con @medicitasAppBot en Telegram | Alta |
| 12 | `12-telegram-recordatorio.png` | Recordatorio en Telegram con botones interactivos | Alta |
| 13 | `13-aws-consolas-ec2.png` | Consola de AWS con las 4 instancias EC2 activas | Crítica |
| 14 | `14-aws-security-groups.png` | Reglas de entrada de los Security Groups en AWS | Alta |
| 15 | `15-terminal-psql-dt.png` | Salida de psql `\dt` y `\dx` en EC2-BD | Alta |
| 16 | `16-terminal-pm2-status.png` | Salida de `pm2 status` en EC2-BACK | Alta |
| 17 | `17-terminal-docker-ps.png` | Salida de `docker ps` en EC2-N8N | Alta |
| 18 | `18-terminal-nginx-status.png` | Salida de `nginx -t` y systemctl en EC2-FRONT | Media |
| 19 | `19-app-ip-publica-navegador.png` | App web abierta en navegador desde IP pública | Crítica |

> **Recordatorio de seguridad:** Antes de incorporar las capturas definitivas, asegúrese de difuminar o censurar visualmente direcciones IP públicas reales, tokens JWT, contraseñas y claves de API.
