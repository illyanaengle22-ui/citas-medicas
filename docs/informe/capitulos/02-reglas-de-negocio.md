# Descripción del sistema y reglas de negocio

MediCitas es una plataforma web para la gestión integral de citas médicas que coordina la interacción entre profesionales de la salud, pacientes y personal administrativo, asegurando la consistencia transaccional y la omnicanalidad a través de la web y Telegram.

## Actores del sistema

1. **Administrador:** Administra usuarios, aprueba cuentas, gestiona consultorios, especialidades, asignaciones médicas y consulta métricas analíticas globales.
2. **Médico:** Configura sus bloques de disponibilidad física, consulta su agenda asistencial y registra la asistencia y notas clínicas de los pacientes.
3. **Paciente:** Se registra en la plataforma, consulta facultativos y especialidades, agenda citas, y gestiona sus reservas (confirmación, cancelación y reprogramación) vía web o Telegram.
4. **Sistema:** Ejecuta tareas programadas en segundo plano: cancelación de citas expiradas, emisión de recordatorios periódicos y auditoría inmutable de estados.

## Catálogo de reglas de negocio

### 1. Usuarios, roles y cuentas (RN-001 a RN-012)

Tabla 1. Reglas de negocio para usuarios, roles y cuentas.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-001** | Todo usuario tiene asignado exactamente un rol (`admin`, `medico`, `paciente`) y un único estado de cuenta. |
| **RN-002** | El correo electrónico (`email`) es único entre cuentas no eliminadas, evaluado de forma insensible a mayúsculas (`CITEXT`). |
| **RN-003** | Todo registro público queda en estado inicial `pendiente` y no puede autenticarse hasta ser aprobado por un administrador. |
| **RN-004** | Solo los administradores pueden aprobar, rechazar, suspender, cambiar roles o dar de baja a otros usuarios. |
| **RN-005** | La aprobación o rechazo aplica exclusivamente sobre cuentas `pendiente` sin marca de eliminación lógica. |
| **RN-006** | Un administrador no puede eliminarse ni revocar su propio rol administrativo, evitando bloqueos irreversibles. |
| **RN-007** | El rol asignado debe existir formalmente en el catálogo relacional `roles`. |
| **RN-008** | Las contraseñas se almacenan mediante hash unidireccional con bcrypt; la API jamás expone el campo `password_hash`. |
| **RN-009** | Cada usuario dispone de un `uuid_publico` generado automáticamente para su exposición hacia clientes externos. |
| **RN-010** | Se registra la marca de tiempo `ultimo_login` ante cada inicio de sesión exitoso. |
| **RN-011** | Al aprobar una cuenta de paciente, el registro dependiente en `pacientes` se crea de forma atómica en la misma transacción. |
| **RN-012** | Los administradores solo se crean por la vía autenticada (`POST /api/usuarios/admin`), nunca por registro público. |

### 2. Autenticación, autorización y seguridad (RN-020 a RN-028)

Tabla 2. Reglas de negocio para autenticación y seguridad.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-020** | El registro y el inicio de sesión exigen resolver un código captcha visual. |
| **RN-021** | Todo captcha es de un solo uso; su valor se destruye de memoria tras su evaluación, sea exitosa o fallida. |
| **RN-022** | Los captchas emitidos expiran automáticamente tras 2 minutos de vigencia (*TTL*). |
| **RN-023** | La comparación del texto del captcha ignora mayúsculas, minúsculas y espacios en blanco. |
| **RN-024** | La autenticación exitosa emite un JWT firmado que encapsula la identidad y el rol vigente del usuario. |
| **RN-025** | Todos los endpoints protegidos requieren el encabezado `Authorization: Bearer <token>`. |
| **RN-026** | Cada ruta restringe accesos por rol; peticiones sin token retornan HTTP 401 y con rol no facultado retornan HTTP 403. |
| **RN-027** | Cuentas en estado `pendiente`, `rechazado` o `suspendido` no pueden iniciar sesión ni emitir tokens. |
| **RN-028** | Todos los secretos operativos (`JWT_SECRET`, claves de base de datos y webhooks) residen exclusivamente en variables de entorno. |

### 3. Especialidades médicas y consultorios físicos (RN-030 a RN-034)

Tabla 3. Reglas de negocio para especialidades y consultorios.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-030** | El nombre de una especialidad médica es obligatorio y único en el sistema. |
| **RN-030b** | La descripción de la especialidad es opcional y está acotada a un máximo de 500 caracteres. |
| **RN-031** | Especialidades inactivas no se ofertan para nuevas citas, pero se preservan para consistencia histórica. |
| **RN-032** | Un consultorio físico requiere obligatoriamente nombre identificador y dirección física. |
| **RN-033** | La baja de consultorios se realiza mediante borrado lógico (`deleted_at`), prohibiendo la eliminación física. |
| **RN-034** | Todo usuario autenticado puede consultar especialidades y consultorios; su administración es exclusiva de administradores. |

### 4. Personal médico y asignaciones (RN-040 a RN-047)

Tabla 4. Reglas de negocio para el módulo de médicos.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-040** | Todo médico está vinculado unívocamente a una cuenta con rol `medico` en relación uno a uno (1:1). |
| **RN-041** | La cédula profesional es única entre los médicos no eliminados. |
| **RN-042** | El alta de un médico crea usuario, ficha profesional y asignaciones en una única transacción atómica. |
| **RN-043** | Un facultativo puede tener múltiples especialidades y sedes asignadas (relaciones N:M). |
| **RN-044** | Un médico solo está visible para agendamiento si está activo, no eliminado y tiene ≥1 especialidad asignada. |
| **RN-045** | La baja de un médico ejecuta borrado lógico en `medicos` y `usuarios`; retorna HTTP 409 si tiene citas futuras vigentes. |
| **RN-046** | La gestión médica es exclusiva de administradores; cédula y correo se ocultan ante consultas de pacientes. |
| **RN-047** | El formato JSON de respuesta del catálogo médico es estable para consumo de la web y n8n. |

### 5. Pacientes y vinculación omnicanal (RN-050 a RN-053)

Tabla 5. Reglas de negocio para el módulo de pacientes.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-050** | Todo paciente corresponde a una cuenta de usuario con rol `paciente` bajo relación 1:1. |
| **RN-051** | El identificador `telegram_chat_id` es único entre pacientes; un chat no puede enlazarse a múltiples cuentas. |
| **RN-052** | Recibir recordatorios o interactuar con el bot demanda tener el `telegram_chat_id` vinculado en el sistema. |
| **RN-053** | Un paciente únicamente cuenta con autorización para consultar y gestionar sus propias citas e información de perfil. |

### 6. Definición de horarios de atención (RN-060 a RN-065)

Tabla 6. Reglas de negocio para horarios de atención.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-060** | Un bloque horario define médico, consultorio, día de la semana (1 a 7, ISO 8601), hora de inicio y fin. |
| **RN-061** | La hora de finalización del bloque debe ser estrictamente posterior a la hora de inicio (`hora_fin > hora_inicio`). |
| **RN-062** | Un médico no puede tener horarios traslapados el mismo día; se garantiza en base de datos mediante `EXCLUDE USING gist`. |
| **RN-063** | Un médico solo puede fijar horarios en consultorios a los que ha sido asignado formalmente. |
| **RN-064** | Un horario puede desactivarse (`activo = false`) sin eliminarse, sin invalidar citas previas concertadas. |
| **RN-065** | Los huecos disponibles se calculan sustrayendo del bloque horario activo los intervalos ocupados por citas vigentes. |

### 7. Ciclo de vida y validación de citas médicas (RN-070 a RN-087)

Tabla 7. Reglas de negocio para creación y validación de citas.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-070** | Una cita relaciona paciente, médico y consultorio con marca temporal con huso horario (`TIMESTAMPTZ`) y duración. |
| **RN-071** | La duración de la consulta debe encontrarse obligatoriamente entre 10 y 240 minutos. |
| **RN-072** | La cita debe ubicarse estrictamente dentro del intervalo de un bloque horario activo del médico en dicho consultorio. |
| **RN-073** | Se prohíbe el registro de citas en fechas u horas pertenecientes al pasado. |
| **RN-074** | Un médico no puede tener dos citas vigentes traslapadas; se garantiza en PostgreSQL mediante restricción GiST. |
| **RN-075** | Al detectarse traslape (código 23P01), la API responde HTTP 409 con el mensaje claro "El horario ya fue ocupado". |
| **RN-076** | Se consideran citas vigentes aquellas en estado `pendiente`, `confirmada` o `reagendada`. |
| **RN-077** | Citas creadas desde la web nacen en estado `pendiente`; citas creadas desde n8n/Telegram nacen `confirmada`. |
| **RN-078** | Un paciente no puede tener dos citas vigentes traslapadas en el tiempo (`ex_citas_sin_traslape_paciente`). |

Tabla 8. Reglas para ciclo de vida y transiciones de citas.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-080** | Las transiciones deben respetar la máquina de estados: `pendiente` a `confirmada`/`cancelada`/`reagendada`; `confirmada` a `cancelada`/`reagendada`/`completada`/`no_asistio`. |
| **RN-081** | Los estados `cancelada`, `completada` y `no_asistio` son terminales; se prohíbe su modificación posterior. |
| **RN-082** | Registrar asistencia (`completada` o `no_asistio`) es exclusivo del médico o admin a partir de la hora de la cita. |
| **RN-083** | Reagendar propone algorítmicamente los 3 huecos libres más cercanos del mismo médico o especialidad. |
| **RN-084** | Al reagendar, la nueva fecha debe revalidar horarios activos (RN-072) y ausencia de traslapes (RN-074 y RN-078). |
| **RN-085** | Cancelar una cita libera inmediatamente el intervalo temporal para nuevos agendamientos. |
| **RN-086** | Cancelar o reagendar exige un margen mínimo de anticipación (2 horas); solo el admin puede obviar este plazo. |
| **RN-087** | Las citas jamás se eliminan físicamente; su anulación se registra mediante transición a `cancelada`. |

### 8. Auditoría inmutable y trazabilidad (RN-090 a RN-093)

Tabla 9. Reglas de negocio para auditoría e historial.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-090** | Todo cambio de estado en una cita se almacena automáticamente en `historial_estados_cita` mediante un trigger. |
| **RN-091** | La auditoría captura estado previo, nuevo, actor (`cambiado_por`), origen (`web`, `telegram`, `sistema`) y comentario. |
| **RN-092** | La tabla de auditoría es estrictamente de solo inserción; un trigger aborta sentencias SQL `UPDATE` o `DELETE`. |
| **RN-093** | Las marcas de tiempo `updated_at` se actualizan automáticamente mediante la función `set_updated_at()`. |

### 9. Notificaciones, recordatorios y Telegram (RN-100 a RN-116)

Tabla 10. Reglas de negocio para recordatorios y Telegram.

| Código | Descripción de la regla de negocio |
|---|---|
| **RN-100** | Se emite un primer recordatorio preventivo 24 horas antes de la cita vía Telegram. |
| **RN-101** | Si no hay confirmación, se emite un segundo recordatorio de insistencia 2 horas antes de la consulta. |
| **RN-102** | Solo se envían recordatorios sobre citas vigentes a pacientes con `telegram_chat_id` vinculado. |
| **RN-103** | El paciente puede interactuar con el recordatorio seleccionando confirmar, cancelar o reagendar. |
| **RN-104** | Cada notificación remitida genera un registro en la tabla `recordatorios` con su estado y respuesta. |
| **RN-105** | No se permite el envío duplicado del mismo tipo de recordatorio para una misma cita (índice único parcial). |
| **RN-106** | Si el despacho a Telegram falla, el error se asienta en la bitácora sin degradar el estado de la cita. |
| **RN-107** | El backend no contacta directamente a Telegram; delega la comunicación a `NotificacionPort` hacia n8n. |
| **RN-116** | La vinculación de Telegram utiliza un código efímero de 6 caracteres con 15 minutos de vigencia canjeado por n8n. |

### 10. Integridad técnica y convenciones de la API (RN-110 a RN-122)

Tabla 11. Reglas técnicas de integridad y convenciones de la API.

| Código | Descripción de la regla de negocio / técnica |
|---|---|
| **RN-110** | Borrado lógico sistemático (`deleted_at`); las consultas filtran `WHERE deleted_at IS NULL`. |
| **RN-111** | Las validaciones críticas de traslapes y rangos se garantizan en la base de datos como última línea de defensa. |
| **RN-112** | Toda operación multi-tabla se ejecuta bajo transacciones atómicas (`BEGIN`, `COMMIT`, `ROLLBACK`). |
| **RN-113** | Los catálogos se referencian por clave semántica (`admin`, `pendiente`), evitando identificadores numéricos fijos. |
| **RN-115** | Errores de unicidad (PostgreSQL 23505) se traducen a respuestas HTTP 409 con mensajes amigables al usuario. |
| **RN-120** | Toda respuesta de la API respeta la estructura `{ "ok": boolean, "mensaje": string, "data": any }`. |
| **RN-121** | Todos los endpoints de la API cuelgan del prefijo canónico `/api/`. |
| **RN-122** | Se utilizan los códigos HTTP estándar: 200, 201, 400, 401, 403, 404, 409 y 500. |

## Matriz de permisos por rol

Tabla 12. Matriz de permisos de acceso según el rol de usuario.

| Recurso o acción en el sistema | Administrador | Médico | Paciente |
|---|:---:|:---:|:---:|
| Registro público de cuenta e inicio de sesión | Sí | Sí | Sí |
| Aprobación, denegación y cambio de rol a usuarios | Sí | No | No |
| Alta, modificación y borrado de personal médico | Sí | No | No |
| Gestión completa (CRUD) de especialidades y consultorios | Sí | No | No |
| Consulta de especialidades, consultorios y médicos activos | Sí | Sí | Sí |
| Configuración de bloques de horarios de atención | Sí | Solo propios | No |
| Creación de citas médicas | Sí | No | Sí |
| Visualización de agenda de citas | Todas | Solo propias | Solo propias |
| Confirmación, cancelación o reagendamiento de citas | Sí | Solo propias | Solo propias |
| Registro de asistencia del paciente a consulta | Sí | Solo propias | No |
| Visualización de auditoría e historial de cambios | Todas | Citas asignadas | Citas propias |
| Acceso a reportes cuantitativos y tableros analíticos | Global | Rendimiento propio | Resumen propio |
