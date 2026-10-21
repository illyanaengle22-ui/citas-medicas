# ENDPOINTS.md — Sistema de Citas Médicas

> Última actualización: 2026-10-21
> Convenciones generales (RN-120 a RN-122):
> - Toda respuesta: `{ "ok": boolean, "mensaje": string, "data": any }`
> - Todos los endpoints cuelgan de `/api/`
> - Autenticación: `Authorization: Bearer <JWT>`
> - **Tipos de `id`**: PostgreSQL devuelve `BIGINT` como **string** en el driver `pg` (Node.js). Los IDs de tipo `SMALLINT` llegan como **number**. Ver tabla abajo.

## Tipos de ID por tabla

| Tabla           | Columna `id` PG | Tipo JS (respuesta JSON) |
|-----------------|-----------------|--------------------------|
| `roles`         | smallint        | number                   |
| `estados_cuenta`| smallint        | number                   |
| `especialidades`| smallint        | number                   |
| `consultorios`  | bigint          | **string**               |
| `medicos`       | bigint          | **string**               |
| `usuarios`      | bigint          | **string**               |
| `pacientes`     | bigint          | **string**               |
| `citas`         | bigint          | **string**               |

---

## Auth

### `POST /api/auth/registrar`
Registro público de un usuario (queda en estado `pendiente`).
- **Acceso:** público
- **Body:** `{ nombre, email, password, captchaId, captchaTexto }`
- **Respuestas:** 201 creado · 400 validación · 409 email duplicado

### `POST /api/auth/login`
- **Acceso:** público
- **Body:** `{ email, password, captchaId, captchaTexto }`
- **Respuestas:** 200 `{ token, usuario }` · 400 campos faltantes · 401 credenciales · 403 cuenta no activa

---

## Especialidades

> Todos requieren token JWT.

| Método | Ruta | Rol mínimo | Descripción |
|--------|------|-----------|-------------|
| GET    | `/api/especialidades` | cualquiera | Listar. Admin: `?todas=true` incluye inactivas |
| GET    | `/api/especialidades/:id` | cualquiera | Obtener por id (`smallint`) |
| POST   | `/api/especialidades` | admin | Crear |
| PUT    | `/api/especialidades/:id` | admin | Actualizar nombre/descripción |
| PATCH  | `/api/especialidades/:id/estado` | admin | `{ activo: boolean }` |

---

## Consultorios

> Todos requieren token JWT.

| Método | Ruta | Rol mínimo | Descripción |
|--------|------|-----------|-------------|
| GET    | `/api/consultorios` | cualquiera | Listar. Admin: `?todos=true` incluye inactivos. `?q=` filtra por nombre/dirección |
| GET    | `/api/consultorios/:id` | cualquiera | Obtener por id (`bigint` → string) |
| POST   | `/api/consultorios` | admin | Crear |
| PUT    | `/api/consultorios/:id` | admin | Actualizar |
| PATCH  | `/api/consultorios/:id/estado` | admin | `{ activo: boolean }` |
| DELETE | `/api/consultorios/:id` | admin | Soft delete. 409 si tiene citas vigentes |

---

## Médicos (RN-040 a RN-047)

> Todos requieren token JWT.
> Admin ve `email` y `cedula_profesional`; médico y paciente no los ven (RN-046).

### Formato estable GET (RN-047)

Todos los endpoints GET de médicos devuelven el mismo objeto:

```json
{
  "id":                 "string (bigint)",
  "usuario_id":         "string (bigint)",
  "nombre":             "string",
  "email":              "string  ← solo admin",
  "medico_mostrar":     "string  (= 'Dr. ' + nombre)",
  "cedula_profesional": "string  ← solo admin",
  "telefono":           "string | null",
  "activo":             "boolean",
  "especialidades": [
    { "id": number (smallint), "nombre": "string" }
  ],
  "consultorios": [
    { "id": "string (bigint)", "nombre": "string" }
  ]
}
```

> **Nota de tipos:** `especialidades[].id` es `smallint` → llega como **number**.  
> `consultorios[].id` es `bigint` → llega como **string**.  
> `medicos.id` y `usuario_id` son `bigint` → llegan como **string**.

### Tabla de endpoints

| Método | Ruta | Rol mínimo | Descripción |
|--------|------|-----------|-------------|
| GET    | `/api/medicos` | cualquiera | Listar médicos |
| GET    | `/api/medicos/:id` | cualquiera | Obtener por id |
| POST   | `/api/medicos` | admin | Crear médico (transacción: usuario + médico + relaciones) |
| PUT    | `/api/medicos/:id` | admin | Actualizar (transacción: usuarios + medicos) |
| PATCH  | `/api/medicos/:id/estado` | admin | `{ activo: boolean }` |
| PUT    | `/api/medicos/:id/especialidades` | admin | Reemplaza conjunto completo `{ especialidades: [ids] }` |
| PUT    | `/api/medicos/:id/consultorios` | admin | Reemplaza conjunto completo `{ consultorios: [ids] }` |
| DELETE | `/api/medicos/:id` | admin | Soft delete de médico + usuario (RN-045). 409 si tiene citas vigentes |

### Parámetros de consulta GET `/api/medicos`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `?todos=true` | — | Solo admin: incluye médicos inactivos |
| `?especialidad=<id>` | smallint | Filtra por especialidad asignada |
| `?consultorio=<id>` | bigint | Filtra por consultorio asignado |
| `?q=<texto>` | string | Busca por nombre o cédula (ILIKE) |

### Reglas de negocio clave

- **RN-042:** POST crea usuario (rol `medico`, estado `activo`), médico y relaciones en **una transacción**. Si algo falla no queda nada.
- **RN-044:** No-admin solo ve médicos activos con ≥1 especialidad activa.
- **RN-045:** DELETE hace soft delete de `medicos` y su `usuarios` en una transacción.
- **RN-046:** No-admin no recibe `email` ni `cedula_profesional`.
- **RN-047:** El formato del array es estable; lo consume el flujo de agendamiento.

### Body POST `/api/medicos`

```json
{
  "nombre":             "string (requerido)",
  "email":              "string (requerido)",
  "password":           "string (mínimo 8 chars)",
  "cedula_profesional": "string (requerido, único entre no eliminados)",
  "telefono":           "string (opcional, 7-15 dígitos; guiones/espacios/paréntesis se eliminan)",
  "especialidades":     [smallint] ,
  "consultorios":       ["string|number (bigint)"]
}
```

### Body PUT `/api/medicos/:id`

Todos los campos son opcionales (al menos uno requerido).  
`password` vacío = no se cambia.

```json
{
  "nombre":             "string",
  "email":              "string",
  "cedula_profesional": "string",
  "telefono":           "string",
  "password":           "string (mínimo 8 chars si se envía)"
}
```

### Errores específicos

| Código | Causa |
|--------|-------|
| 400 | Validación de campo (nombre, email, contraseña, cédula, teléfono) |
| 400 | Especialidad o consultorio inexistente / inactivo al crear o reemplazar |
| 401 | Sin token |
| 403 | Rol sin permiso |
| 404 | Médico no encontrado |
| 409 | Email ya registrado |
| 409 | Cédula profesional ya registrada |
| 409 | Médico tiene citas vigentes (al intentar eliminar) |

---

## Usuarios

> Todos requieren token JWT.

| Método | Ruta | Rol mínimo | Descripción |
|--------|------|-----------|-------------|
| GET    | `/api/usuarios` | admin | Listar con paginación `?page=&limit=&rol=&estado=&q=` |
| GET    | `/api/usuarios/pendientes` | admin | Listar cuentas pendientes |
| GET    | `/api/usuarios/:id` | admin | Obtener usuario por id |
| POST   | `/api/usuarios/admin` | admin | Crear usuario admin o paciente |
| PUT    | `/api/usuarios/:id` | admin | Actualizar nombre/email/password |
| PATCH  | `/api/usuarios/:id/aprobar` | admin | Aprobar cuenta pendiente |
| PATCH  | `/api/usuarios/:id/rechazar` | admin | Rechazar cuenta pendiente |
| PATCH  | `/api/usuarios/:id/rol` | admin | Cambiar rol (no hacia/desde médico) |
| DELETE | `/api/usuarios/:id` | admin | Soft delete |

---

## Pacientes

> Todos requieren token JWT.

| Método | Ruta | Rol mínimo | Descripción |
|--------|------|-----------|-------------|
| GET    | `/api/pacientes` | admin | Listar pacientes |
| GET    | `/api/pacientes/:id` | admin | Obtener paciente por id |
| POST   | `/api/pacientes` | admin | Crear registro de paciente |
| PUT    | `/api/pacientes/:id` | admin | Actualizar datos del paciente |
| DELETE | `/api/pacientes/:id` | admin | Soft delete |

> ⚠️ **Pendiente de mejora:** `PacientesController` no tiene `roleMiddleware` ni `validarId`. Ver sección de auditoría.

---

## Dashboard

| Método | Ruta | Rol mínimo | Descripción |
|--------|------|-----------|-------------|
| GET    | `/api/dashboard` | admin | Estadísticas generales |

---

## Notas de implementación

- Todos los `500` registran con `console.error` y devuelven mensaje genérico (nunca `error.message` al cliente).
- Código `23505` PostgreSQL → 409 con mensaje diferenciado por campo.
- Los catálogos (`roles`, `estados_cuenta`, `estados_cita`) se referencian **por clave** en subconsultas, nunca por ID numérico fijo (RN-113).
- Borrado lógico (`deleted_at`) en todas las tablas de negocio; las consultas filtran `deleted_at IS NULL` (RN-110).
