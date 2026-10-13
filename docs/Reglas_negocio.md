# Reglas de negocio — Sistema de Citas Médicas

> **Versión:** 1.0 · **Ubicación sugerida:** `docs/REGLAS_DE_NEGOCIO.md`
>
> Cada regla tiene un código (`RN-XXX`) para poder citarla en el código, en los casos de uso y en el informe académico.
> Las reglas marcadas con 🔶 son **propuestas** que deben confirmarse con el equipo o el profesor; el resto proviene del diseño del schema y del plan del proyecto.

---

## 1. Propósito y alcance

El sistema permite gestionar citas médicas: registro y aprobación de usuarios, administración de médicos, especialidades y consultorios, definición de horarios, agendamiento de citas y recordatorios automáticos por Telegram (vía n8n).

**Actores:**

| Actor | Descripción |
|---|---|
| **Administrador** | Gestiona usuarios, roles, médicos, especialidades, consultorios y tiene visión global de citas. |
| **Médico** | Define sus horarios, consulta su agenda y gestiona la asistencia de sus pacientes. |
| **Paciente** | Se registra, agenda, consulta, confirma, cancela y reagenda sus citas. |
| **Sistema** | Ejecuta acciones automáticas: auditoría de estados, recordatorios y procesamiento de respuestas de Telegram. |

---

## 2. Usuarios, roles y cuentas

| Código | Regla |
|---|---|
| RN-001 | Todo usuario tiene exactamente **un rol** (`admin`, `medico` o `paciente`) y **un estado de cuenta**. |
| RN-002 | El **email es único** entre usuarios no eliminados (sin distinguir mayúsculas). |
| RN-003 | Un usuario nuevo que se registra por sí mismo queda en estado **pendiente** y no puede iniciar sesión hasta que un administrador lo apruebe. |
| RN-004 | Solo un **administrador** puede aprobar, rechazar, cambiar el rol o eliminar usuarios. |
| RN-005 | Solo se puede aprobar o rechazar una cuenta que esté en estado **pendiente** y no eliminada. |
| RN-006 | Un administrador **no puede eliminarse ni quitarse el rol de admin a sí mismo**. |
| RN-007 | El rol asignado debe existir en el catálogo `roles`; no se aceptan valores libres. |
| RN-008 | Las contraseñas se almacenan **solo como hash** (bcrypt). Ninguna respuesta de la API incluye `password_hash`. |
| RN-009 | Cada usuario tiene un `uuid_publico` para exponerse en el exterior; el `id` interno no debe usarse como identificador público. |
| RN-010 | Se registra la fecha del **último login** en cada inicio de sesión exitoso. |
| RN-011 | Al aprobar un usuario con rol paciente debe existir su registro en `pacientes`; si no existe, se crea en la misma transacción. 🔶 |
| RN-012 | Los administradores solo se crean por la vía administrativa (`POST /api/usuarios/admin`), nunca por el registro público. 🔶 |

### Estados de cuenta

| Estado | Significado | ¿Puede iniciar sesión? |
|---|---|---|
| `pendiente` | Registrado, esperando aprobación | No |
| `activo` | Aprobado | Sí |
| `rechazado` / `suspendido` 🔶 | Denegado o bloqueado | No |

---

## 3. Autenticación y seguridad

| Código | Regla |
|---|---|
| RN-020 | El registro y el login exigen resolver un **captcha** válido. |
| RN-021 | Cada captcha es de **un solo uso**: se elimina al validarse, tanto si el intento es correcto como si falla. |
| RN-022 | Un captcha **expira a los 2 minutos**. |
| RN-023 | La comparación del texto del captcha **no distingue mayúsculas** y se ignoran espacios. |
| RN-024 | Tras el login se emite un **JWT** con la identidad (`id`) y el rol del usuario. |
| RN-025 | Todas las rutas, salvo login, registro y captcha, requieren un token válido (`Authorization: Bearer <token>`). |
| RN-026 | Cada ruta define los roles que pueden usarla; un rol no autorizado recibe **403**, un token ausente o inválido recibe **401**. |
| RN-027 | Un usuario con cuenta no activa no puede obtener un token. |
| RN-028 | Los secretos (`JWT_SECRET`, credenciales de base de datos, token del bot) viven en variables de entorno y nunca en el repositorio. |

---

## 4. Especialidades y consultorios

| Código | Regla |
|---|---|
| RN-030 | El nombre de una **especialidad es único** y obligatorio. |
| RN-031 | Una especialidad desactivada no se ofrece para nuevas asignaciones ni para agendar, pero se conserva en el historial. |
| RN-032 | Un consultorio requiere **nombre** y **dirección**. |
| RN-033 | Los consultorios se eliminan con **borrado lógico** (`deleted_at`); nunca se borran físicamente. |
| RN-034 | Listar especialidades y consultorios está permitido a cualquier usuario autenticado; crear, editar o eliminar es solo de administradores. |

---

## 5. Médicos

| Código | Regla |
|---|---|
| RN-040 | Todo médico está vinculado a **un único usuario** con rol `medico` (relación 1:1). |
| RN-041 | La **cédula profesional es única** entre médicos no eliminados. |
| RN-042 | Registrar un médico crea usuario, médico y asignaciones en **una sola transacción**; si algo falla, no se guarda nada. |
| RN-043 | Un médico puede tener **varias especialidades** y atender en **varios consultorios** (relaciones N:M). |
| RN-044 | Un médico solo aparece para agendar si está **activo**, no eliminado y tiene al menos una especialidad. 🔶 |
| RN-045 | Eliminar un médico es un borrado lógico que afecta a `medicos` y a su `usuarios` en una transacción. |
| RN-046 | Solo un administrador puede crear, editar, asignar especialidades o consultorios y eliminar médicos. |
| RN-047 | El formato de respuesta de `GET /api/medicos` es estable, porque lo consume el flujo de agendamiento. |

---

## 6. Pacientes

| Código | Regla |
|---|---|
| RN-050 | Todo paciente está vinculado a **un único usuario** con rol `paciente` (relación 1:1). |
| RN-051 | El `telegram_chat_id` es **único** entre pacientes; un chat no puede estar ligado a dos pacientes. |
| RN-052 | Para recibir recordatorios el paciente debe tener un `telegram_chat_id` vinculado. 🔶 |
| RN-053 | Un paciente solo puede ver y gestionar **sus propias citas**. |

---

## 7. Horarios de atención

| Código | Regla |
|---|---|
| RN-060 | Un horario define: médico, consultorio, **día de la semana (1–7)**, hora de inicio y hora de fin. |
| RN-061 | La **hora de fin debe ser posterior a la de inicio**. |
| RN-062 | Un médico **no puede tener horarios traslapados el mismo día**. Se garantiza en la base de datos con `EXCLUDE USING gist`. |
| RN-063 | El médico solo puede tener horarios en consultorios a los que está asignado. 🔶 |
| RN-064 | Un horario puede desactivarse (`activo = false`) sin borrarse. Las citas ya agendadas no se eliminan automáticamente. 🔶 |
| RN-065 | Los horarios disponibles para agendar son los horarios activos del médico menos el tiempo ocupado por citas vigentes. |

---

## 8. Citas

### 8.1 Creación y validación

| Código | Regla |
|---|---|
| RN-070 | Una cita relaciona un **paciente**, un **médico** y un **consultorio**, con fecha y hora (`TIMESTAMPTZ`) y duración. |
| RN-071 | La **duración** debe estar entre **10 y 240 minutos**. |
| RN-072 | La cita debe caer **dentro de un horario activo** del médico en ese consultorio. |
| RN-073 | No se pueden agendar citas en el **pasado**. 🔶 |
| RN-074 | Un médico **no puede tener dos citas vigentes que se traslapen** en el tiempo. Se garantiza en la base de datos con `EXCLUDE USING gist`, lo que evita el doble agendamiento aun con usuarios concurrentes. |
| RN-075 | Si el traslape es detectado por la base de datos, la API responde con un mensaje claro (por ejemplo, *"El horario ya fue ocupado"*) y no con un error técnico. |
| RN-076 | Se consideran **vigentes** las citas en estado `pendiente`, `confirmada` o `reagendada`. Las canceladas y las finalizadas no bloquean el horario. |
| RN-077 | Una cita nueva se crea en estado **pendiente**. |
| RN-078 | Un paciente no puede tener dos citas vigentes que se traslapen. 🔶 |

### 8.2 Ciclo de vida

| Estado | Descripción | ¿Bloquea horario? |
|---|---|---|
| `pendiente` | Recién agendada | Sí |
| `confirmada` | Confirmada por el paciente (web o Telegram) | Sí |
| `reagendada` | Movida a un nuevo horario | Sí |
| `cancelada` | Anulada por paciente, médico, admin o sistema | No |
| `completada` / `asistio` 🔶 | El paciente fue atendido | No |
| `no_asistio` 🔶 | El paciente no se presentó | No |

**Transiciones permitidas** 🔶

```
pendiente  → confirmada | cancelada | reagendada
confirmada → cancelada | reagendada | completada | no_asistio
reagendada → confirmada | cancelada | completada | no_asistio
cancelada, completada, no_asistio → (estados finales, sin cambios)
```

| Código | Regla |
|---|---|
| RN-080 | Solo se permiten las transiciones de la tabla anterior; las demás se rechazan. 🔶 |
| RN-081 | Los **estados finales no se pueden modificar**. 🔶 |
| RN-082 | Marcar la asistencia (`completada` / `no_asistio`) solo corresponde al médico de la cita o a un administrador, y solo a partir de la hora de inicio. 🔶 |
| RN-083 | **Reagendar** propone al paciente los **3 horarios libres más cercanos** del mismo médico. |
| RN-084 | Al reagendar se valida de nuevo la disponibilidad (RN-072 y RN-074) antes de confirmar el cambio. |
| RN-085 | Cancelar libera inmediatamente el horario. |
| RN-086 | Hay un plazo mínimo de **anticipación para cancelar o reagendar** (por ejemplo, 2 horas antes). 🔶 |
| RN-087 | Las citas **no se eliminan físicamente**; se cancelan o se marcan con borrado lógico. |

### 8.3 Visibilidad según rol

| Rol | Qué citas ve |
|---|---|
| Administrador | Todas, con filtros |
| Médico | Solo las suyas |
| Paciente | Solo las suyas |

---

## 9. Auditoría e historial

| Código | Regla |
|---|---|
| RN-090 | **Cada cambio de estado** de una cita se registra automáticamente en `historial_estados_cita` mediante un trigger de base de datos. |
| RN-091 | El historial guarda: estado anterior, estado nuevo, quién lo cambió (`cambiado_por`, **nulo si lo hizo el sistema**), origen (web, Telegram, sistema) y comentario. |
| RN-092 | El historial **no se edita ni se borra**: es de solo inserción. |
| RN-093 | `updated_at` se actualiza automáticamente mediante el trigger `set_updated_at()` en todas las tablas que lo incluyen. |

---

## 10. Recordatorios y Telegram

| Código | Regla |
|---|---|
| RN-100 | Se envía un **primer recordatorio 24 horas antes** de la cita, por Telegram. |
| RN-101 | Si no hay respuesta, se envía un **segundo recordatorio 2 horas antes**. |
| RN-102 | Solo se envían recordatorios de citas **vigentes** (pendiente, confirmada o reagendada) y a pacientes con Telegram vinculado. |
| RN-103 | El paciente responde desde Telegram con **confirmar**, **cancelar** o **reagendar**; el sistema actualiza la cita según la respuesta. |
| RN-104 | Cada recordatorio queda registrado con canal, tipo, estado, respuesta y fechas de envío y respuesta. |
| RN-105 | No se envía el mismo tipo de recordatorio dos veces para la misma cita. 🔶 |
| RN-106 | Si el envío falla, el estado del recordatorio refleja el fallo y la cita **no se ve afectada**. 🔶 |
| RN-107 | El backend no habla directamente con Telegram: usa el puerto `NotificacionPort`, implementado por el adaptador de n8n. |

---

## 11. Reglas de datos e integridad

| Código | Regla |
|---|---|
| RN-110 | **Borrado lógico** (`deleted_at`) en tablas de negocio; las consultas deben filtrar `deleted_at IS NULL`. |
| RN-111 | Las reglas críticas (traslapes, duraciones, horarios) se aplican **en la base de datos**, no solo en el backend. |
| RN-112 | Las operaciones que tocan varias tablas se ejecutan en **transacciones** (`BEGIN` / `COMMIT` / `ROLLBACK`). |
| RN-113 | Los catálogos (`roles`, `estados_cuenta`, `estados_cita`) se referencian por **clave**, no por ID numérico fijo. |
| RN-114 | Los cambios al schema no se hacen unilateralmente: se avisa al otro integrante antes de cualquier `ALTER`. |
| RN-115 | Los errores de unicidad (código `23505`) se traducen a mensajes claros para el usuario (email, cédula o especialidad duplicados). |

---

## 12. Convenciones de la API

| Código | Regla |
|---|---|
| RN-120 | Toda respuesta tiene la forma `{ "ok": boolean, "mensaje": string, "data": any }`. |
| RN-121 | Los endpoints cuelgan de `/api/...`. |
| RN-122 | Códigos HTTP: `200` OK, `201` creado, `400` datos inválidos, `401` sin sesión, `403` sin permiso, `404` no encontrado, `409` conflicto (duplicados o traslape), `500` error interno. |
| RN-123 | Los endpoints se documentan en `docs/ENDPOINTS.md` **antes** de programarse. |

---

## 13. Matriz de permisos

| Recurso / acción | Admin | Médico | Paciente |
|---|:---:|:---:|:---:|
| Registrarse / iniciar sesión | ✔ | ✔ | ✔ |
| Aprobar, rechazar y asignar rol a usuarios | ✔ | — | — |
| Crear, editar y eliminar médicos | ✔ | — | — |
| CRUD de especialidades y consultorios | ✔ | — | — |
| Listar especialidades, consultorios y médicos | ✔ | ✔ | ✔ |
| Gestionar horarios | ✔ | Solo los suyos | — |
| Agendar una cita | ✔ | — 🔶 | ✔ |
| Ver citas | Todas | Las suyas | Las suyas |
| Confirmar, cancelar o reagendar una cita | ✔ | ✔ | Solo las suyas |
| Marcar asistencia | ✔ | Solo las suyas | — |
| Ver historial de estados | ✔ | Sus citas | Sus citas |
| Ver estadísticas del dashboard | ✔ | Propias | Propias |

---

## 14. Pendientes por confirmar (🔶)

- [ ] Nombres exactos de las claves de `estados_cuenta` y `estados_cita` sembradas en la base de datos.
- [ ] Diagrama de transiciones de estado definitivo (RN-080).
- [ ] Plazo mínimo para cancelar o reagendar (RN-086).
- [ ] Si los médicos pueden agendar citas a nombre de un paciente.
- [ ] Quién crea el registro en `pacientes`: el registro público o la aprobación (RN-011).
- [ ] Cómo se vincula el paciente con su `telegram_chat_id`.
- [ ] Si se permite cancelar o reagendar citas ya iniciadas.
