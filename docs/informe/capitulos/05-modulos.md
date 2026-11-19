# Módulos del sistema

MediCitas se organiza en dos macro-módulos interconectados: **Gestión Clínica** y **Agenda y Notificaciones**, garantizando la segregación de funciones según el rol de usuario autenticado.

## Módulo 1: Gestión clínica

Centraliza la administración de usuarios, control de accesos, infraestructura física y personal facultativo.

1. **Gestión de usuarios y accesos:** Gobierna el registro público con captcha visual (`Registro.jsx`), autenticación (`Login.jsx`), aprobación y asignación de roles por el administrador (`AdminUsuarios.jsx`), y actualización de perfil (`Perfil.jsx`).
2. **Infraestructura médica (Especialidades y Consultorios):** Administra el catálogo de disciplinas médicas (`AdminEspecialidades.jsx`) y consultorios físicos (`AdminConsultorios.jsx`), con borrado lógico protegido ante citas vigentes.
3. **Ficha y asignación de personal médico:** Permite el registro atómico de médicos (`AdminMedicos.jsx`), vinculando usuario, cédula profesional, especialidades y consultorios autorizados.

En la Tabla 15 se sintetiza la correspondencia entre interfaces, roles y endpoints del módulo.

Tabla 15. Correspondencia de pantallas, roles y endpoints del módulo de Gestión Clínica.

| Pantalla frontend | Roles autorizados | Endpoints de la API REST consumidos |
|---|---|---|
| `Registro` / `Login` | Público | `POST /api/auth/registrar`, `POST /api/auth/login`, `GET /api/captcha` |
| `AdminUsuarios` | Administrador | `GET /api/usuarios`, `PUT /api/usuarios/:id/aprobar`, `DELETE /api/usuarios/:id` |
| `AdminEspecialidades` | Administrador | `GET /api/especialidades`, `POST /api/especialidades`, `PATCH /api/especialidades/:id/estado` |
| `AdminConsultorios` | Administrador | `GET /api/consultorios`, `POST /api/consultorios`, `DELETE /api/consultorios/:id` |
| `AdminMedicos` | Administrador | `GET /api/medicos`, `POST /api/medicos`, `PUT /api/medicos/:id/especialidades` |
| `Perfil` | Todos | `GET /api/perfil`, `PUT /api/perfil`, `POST /api/perfil/foto` |

---

## Módulo 2: Agenda y notificaciones

Administra la oferta de disponibilidad semanal, agendamiento de citas, control asistencial y la integración con Telegram.

1. **Horarios de atención:** Permite a médicos y administradores configurar bloques semanales de disponibilidad recurrente (`AdminHorarios.jsx`, `MisHorarios.jsx`) con validación de traslapes en base de datos.
2. **Agendamiento y gestión de citas:** Asistente guiado para pacientes con cálculo dinámico de huecos libres (`AgendarCita.jsx`), gestión de reservas del paciente (`MisCitas.jsx`), agenda del médico con registro de asistencia y notas (`MiAgenda.jsx`), y calendario institucional con FullCalendar (`AdminCalendario.jsx`).
3. **Notificaciones y vinculación con Telegram:** Generación de códigos efímeros de 6 caracteres para enlazar la cuenta del paciente (`VincularTelegram.jsx`), despacho de recordatorios preventivos y recepción de respuestas conversacionales vía webhook.

En la Tabla 16 se presenta la correspondencia operativa del módulo.

Tabla 16. Correspondencia de pantallas, roles y endpoints del módulo de Agenda y Notificaciones.

| Pantalla frontend | Roles autorizados | Endpoints de la API REST consumidos |
|---|---|---|
| `MisHorarios` / `AdminHorarios` | Médico, Admin | `GET /api/horarios`, `POST /api/horarios`, `DELETE /api/horarios/:id` |
| `AgendarCita` | Paciente, Admin | `GET /api/especialidades`, `GET /api/medicos`, `GET /api/horarios/medico/:id`, `POST /api/citas` |
| `MisCitas` | Paciente | `GET /api/citas`, `PUT /api/citas/:id/confirmar`, `GET /api/citas/:id/propuestas`, `PUT /api/citas/:id` |
| `MiAgenda` | Médico | `GET /api/citas`, `PUT /api/citas/:id/estado`, `GET /api/citas/mis-pacientes` |
| `AdminCitas` / `AdminCalendario` | Administrador | `GET /api/citas`, `PUT /api/citas/:id/estado`, `GET /api/citas/:id/historial` |
| `VincularTelegram` | Paciente | `POST /api/telegram/codigo`, `GET /api/telegram/estado`, `DELETE /api/telegram/vincular` |
