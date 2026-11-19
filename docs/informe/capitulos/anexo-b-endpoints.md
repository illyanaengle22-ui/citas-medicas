# Anexo B: Catálogo consolidado de endpoints de la API REST

En la Tabla 24 se presenta el inventario exhaustivo de los endpoints expuestos por la API REST de MediCitas, indicando el método HTTP, la ruta canónica bajo el prefijo `/api/`, el rol de acceso mínimo requerido y su función operativa.

Tabla 24. Inventario consolidado de endpoints de la API REST de MediCitas.

| Método | Ruta del recurso | Rol o autenticación requerida | Descripción funcional | Códigos HTTP |
|:---:|---|---|---|:---:|
| `POST` | `/api/auth/registrar` | Público | Registro de nueva cuenta de usuario (estado inicial `pendiente`). | 201, 400, 409 |
| `POST` | `/api/auth/login` | Público | Autenticación con credenciales y captcha; emisión de JWT. | 200, 400, 401, 403 |
| `GET` | `/api/captcha` | Público | Emisión de captcha visual SVG y su identificador temporal. | 200, 500 |
| `GET` | `/api/perfil` | Autenticado (Cualquiera) | Consulta de datos del perfil del usuario en sesión. | 200, 401, 404 |
| `PUT` | `/api/perfil` | Autenticado (Cualquiera) | Modificación de nombre y datos personales. | 200, 400, 401 |
| `POST` | `/api/perfil/foto` | Autenticado (Cualquiera) | Carga de fotografía de perfil en formato multipart/form-data. | 200, 400, 401 |
| `GET` | `/api/usuarios` | `admin` | Consulta paginada de usuarios con filtros por rol y estado. | 200, 401, 403 |
| `GET` | `/api/usuarios/pendientes`| `admin` | Listado exclusivo de cuentas pendientes de aprobación. | 200, 401, 403 |
| `GET` | `/api/usuarios/:id` | `admin` | Consulta detallada de una cuenta de usuario específica. | 200, 401, 403, 404 |
| `POST` | `/api/usuarios` | `admin` | Alta directa de usuarios administradores o pacientes. | 201, 400, 401, 403, 409 |
| `PUT` | `/api/usuarios/:id` | `admin` | Actualización administrativa de cuenta. | 200, 400, 401, 403, 404 |
| `PUT` | `/api/usuarios/:id/aprobar`| `admin` | Transición de cuenta de `pendiente` a `activo`. | 200, 401, 403, 404 |
| `DELETE`| `/api/usuarios/:id/negar`| `admin` | Rechazo definitivo de solicitud de cuenta pendiente. | 200, 401, 403, 404 |
| `PATCH` | `/api/usuarios/:id/rol` | `admin` | Modificación del rol asignado a un usuario. | 200, 400, 401, 403, 404 |
| `DELETE`| `/api/usuarios/:id` | `admin` | Borrado lógico de cuenta de usuario (`deleted_at`). | 200, 401, 403, 404 |
| `GET` | `/api/especialidades` | Autenticado (Cualquiera) | Listado de especialidades activas (`?todas=true` para admin). | 200, 401 |
| `GET` | `/api/especialidades/:id`| Autenticado (Cualquiera) | Detalle de especialidad por ID. | 200, 401, 404 |
| `POST` | `/api/especialidades` | `admin` | Creación de nueva especialidad médica. | 201, 400, 401, 403, 409 |
| `PUT` | `/api/especialidades/:id`| `admin` | Actualización de nombre y descripción de especialidad. | 200, 400, 401, 403, 404 |
| `PATCH` | `/api/especialidades/:id/estado`| `admin` | Modificación de vigencia operativa (`activo: boolean`). | 200, 400, 401, 403, 404 |
| `GET` | `/api/consultorios` | Autenticado (Cualquiera) | Consulta de consultorios físicos (`?todos=true` para admin). | 200, 401 |
| `GET` | `/api/consultorios/:id` | Autenticado (Cualquiera) | Detalle de consultorio por ID. | 200, 401, 404 |
| `POST` | `/api/consultorios` | `admin` | Alta de nuevo consultorio físico. | 201, 400, 401, 403 |
| `PUT` | `/api/consultorios/:id` | `admin` | Actualización de datos de sede o consultorio. | 200, 400, 401, 403, 404 |
| `PATCH` | `/api/consultorios/:id/estado`| `admin` | Modificación de estado activo de consultorio. | 200, 400, 401, 403, 404 |
| `DELETE`| `/api/consultorios/:id` | `admin` | Borrado lógico de consultorio (409 si tiene citas vigentes).| 200, 401, 403, 404, 409 |
| `GET` | `/api/medicos` | Autenticado (Cualquiera) | Catálogo de médicos con especialidades y sedes asignadas. | 200, 401 |
| `GET` | `/api/medicos/:id` | Autenticado (Cualquiera) | Consulta de ficha de médico específico. | 200, 401, 404 |
| `POST` | `/api/medicos` | `admin` | Alta transaccional de usuario, médico y asignaciones. | 201, 400, 401, 403, 409 |
| `PUT` | `/api/medicos/:id` | `admin` | Modificación de datos profesionales del médico. | 200, 400, 401, 403, 404 |
| `PATCH` | `/api/medicos/:id/estado`| `admin` | Activación o desactivación de médico. | 200, 400, 401, 403, 404 |
| `PUT` | `/api/medicos/:id/especialidades`| `admin` | Reemplazo completo de especialidades del facultativo. | 200, 400, 401, 403, 404 |
| `PUT` | `/api/medicos/:id/consultorios`| `admin` | Reemplazo completo de consultorios autorizados. | 200, 400, 401, 403, 404 |
| `DELETE`| `/api/medicos/:id` | `admin` | Baja lógica de médico y cuenta asociada (409 con citas). | 200, 401, 403, 404, 409 |
| `GET` | `/api/pacientes` | `admin` | Listado general de pacientes registrados. | 200, 401, 403 |
| `GET` | `/api/pacientes/:id` | `admin` o paciente propio | Detalle de paciente (RN-053: propio paciente o admin). | 200, 400, 401, 403, 404 |
| `PUT` | `/api/pacientes/:id` | `admin` | Modificación de datos de ficha de paciente. | 200, 400, 401, 403, 404 |
| `DELETE`| `/api/pacientes/:id` | `admin` | Borrado lógico de paciente y usuario (409 con citas). | 200, 401, 403, 404, 409 |
| `GET` | `/api/horarios` | `admin` o `medico` | Listado de bloques de horarios (médico ve solo los suyos).| 200, 401, 403 |
| `GET` | `/api/horarios/medico/:id`| Autenticado (Cualquiera) | Cálculo dinámico de huecos libres por fecha y duración. | 200, 400, 401, 404 |
| `POST` | `/api/horarios` | `admin` o `medico` | Alta de bloque semanal con exclusión de traslapes GiST. | 201, 400, 401, 403, 409 |
| `DELETE`| `/api/horarios/:id` | `admin` o `medico` dueño | Desactivación de bloque horario (`activo = false`). | 200, 401, 403, 404 |
| `GET` | `/api/citas` | Autenticado (Cualquiera) | Listado de citas (filtrado automático según rol del token). | 200, 401 |
| `GET` | `/api/citas/mis-pacientes`| `medico` | Pacientes atendidos por el médico con conteos históricos. | 200, 401, 403 |
| `GET` | `/api/citas/:id` | Dueño, médico o `admin` | Detalle exhaustivo de una cita médica. | 200, 401, 403, 404 |
| `GET` | `/api/citas/:id/historial`| Dueño, médico o `admin` | Trazabilidad inmutable de estados de la cita (RN-090). | 200, 401, 403, 404 |
| `GET` | `/api/citas/:id/propuestas`| Dueño, médico o `admin` | Cálculo de los 3 huecos libres más cercanos para reagendar.| 200, 400, 401, 403, 404 |
| `POST` | `/api/citas` | `paciente` o `admin` | Agendamiento de cita (creada como `confirmada` si webhook).| 201, 400, 401, 403, 409 |
| `PUT` | `/api/citas/:id/confirmar`| Dueño, médico o `admin` | Transición de estado a `confirmada`. | 200, 400, 401, 403, 404 |
| `PUT` | `/api/citas/:id/estado` | Dueño, médico o `admin` | Transición a `cancelada`, `completada` o `no_asistio`. | 200, 400, 401, 403, 404 |
| `PUT` | `/api/citas/:id` | Dueño, médico o `admin` | Reagendamiento de fecha, hora o médico de cita vigente. | 200, 400, 401, 403, 404, 409 |
| `DELETE`| `/api/citas/:id` | Dueño, médico o `admin` | Cancelación de cita médica y liberación de horario. | 200, 400, 401, 403, 404 |
| `GET` | `/api/dashboard/admin` | `admin` | Resumen consolidado analítico para el administrador. | 200, 400, 401, 403, 500 |
| `GET` | `/api/dashboard/medico` | `medico` | Indicadores y agenda diaria consolidada para el médico. | 200, 401, 403, 500 |
| `GET` | `/api/dashboard/paciente`| `paciente` | Próxima cita, citas programadas e historial para paciente. | 200, 401, 403, 500 |
| `POST` | `/api/recordatorios/enviar`| `admin` | Disparo manual o programado del job de recordatorios. | 200, 401, 403 |
| `POST` | `/api/recordatorios/confirmar`| Autenticado (Cualquiera)| Registro de respuesta del paciente a una notificación. | 200, 400, 401 |
| `GET` | `/api/recordatorios/cita/:id`| Dueño, médico o `admin` | Consulta de notificaciones despachadas para una cita. | 200, 401, 403, 404 |
| `POST` | `/api/telegram/codigo` | `paciente` | Emisión de código de vinculación de 6 caracteres (15 min). | 200, 401, 403 |
| `GET` | `/api/telegram/estado` | `paciente` | Consulta del estado de enlace con Telegram del paciente. | 200, 401, 403 |
| `DELETE`| `/api/telegram/vincular` | `paciente` | Desvinculación voluntaria del chat de Telegram propio. | 200, 401, 403 |
| `POST` | `/api/telegram/vincular` | `x-webhook-secret` | Canje de código y asociación atómica del `telegram_chat_id`.| 200, 400, 401, 409 |
| `GET` | `/api/telegram/estado/:chatId`| `x-webhook-secret` | Verificación de estado de vinculación de un chat específico.| 200, 400, 401 |
| `POST` | `/api/telegram/sesion` | `x-webhook-secret` | Obtención de sesión y token JWT de paciente por `chatId`. | 200, 400, 401 |
| `POST` | `/api/telegram/token` | `x-webhook-secret` | Emisión de token JWT fresco para el agente conversacional. | 200, 400, 401, 404 |
| `POST` | `/api/webhooks/n8n/respuesta`| `x-webhook-secret` | Punto de entrada para respuestas asíncronas de Telegram. | 200, 400, 401, 404 |
| `GET` | `/api/webhooks/n8n/health`| Público / n8n | Ping de comprobación de enlace de red para n8n. | 200 |
| `GET` | `/api/health` | Público | Comprobación de salud básica del servidor Express. | 200 |
