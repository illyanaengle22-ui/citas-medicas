# ENDPOINTS.md — Sistema de Citas Médicas

> Última actualización: 2026-10-22
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
> `pacientes.id` y `pacientes.usuario_id` son **BIGINT** (se reciben como string en JSON).

| Método | Ruta | Rol permitido | Descripción |
|--------|------|---------------|-------------|
| GET    | `/api/pacientes` | admin | Listar pacientes |
| GET    | `/api/pacientes/:id` | admin o el propio paciente | Obtener paciente por id |
| POST   | `/api/pacientes` | admin | Crear registro de paciente |
| PUT    | `/api/pacientes/:id` | admin | Actualizar datos del paciente |
| DELETE | `/api/pacientes/:id` | admin | Soft delete del paciente y de su usuario |

#### Reglas de acceso y validación

- **RN-053:** en `GET /api/pacientes/:id`, un paciente solo puede consultar el registro cuyo `usuario_id` coincide con el `id` de su token. Si intenta ver el registro de otro paciente → **403**.
- **Médicos:** el acceso de un médico a "sus pacientes" todavía no está implementado porque la relación médico–paciente se define a través de las citas. Hasta que exista esa lógica, `GET /api/pacientes/:id` responde **403** a un token de médico.
- **IDs:** se valida el tipo real `BIGINT`. Un id inválido o fuera de rango → **400**; un id válido que no existe o está eliminado → **404**.
- **Listado y detalle:** los `SELECT` que unen `pacientes` con `usuarios` filtran `p.deleted_at IS NULL` y `u.deleted_at IS NULL`.
- **Eliminación:** hace soft delete de `pacientes` y de su `usuarios` en una sola transacción. Si el paciente tiene citas futuras vigentes (`pendiente`, `confirmada` o `reagendada`, resueltas por clave) → **409**.
- Tras eliminar el paciente, su usuario queda con `deleted_at`, por lo que ya no puede iniciar sesión y su email vuelve a quedar disponible.
- Los errores `500` registran el detalle solo en `console.error`; la respuesta al cliente es genérica y nunca incluye `error.message`.

---

## Dashboard

### `GET /api/dashboard/admin`

Resumen consolidado para el dashboard del administrador. Es una consulta de
solo lectura y requiere rol **admin**.

- **Acceso:** `Authorization: Bearer <JWT>` con `rol_id = 1` (clave `admin`).
- **Query params opcionales:**
  - `fecha_inicio`: fecha inicial inclusiva en formato `YYYY-MM-DD`.
  - `fecha_fin`: fecha final inclusiva en formato `YYYY-MM-DD`.
- **Valores por defecto:** si no se envían, se usan los últimos **30 días**
  (desde `hoy - 29 días` hasta `hoy`). Si solo se envía `fecha_fin`, el rango
  son los 30 días que terminan en esa fecha; si solo se envía `fecha_inicio`,
  el rango termina hoy.
- **Agrupación de `registrosPorMes`:** hasta 60 días se agrupa por día
  (`DATE(created_at)`); con más de 60 días se agrupa por mes
  (`DATE_TRUNC('month', created_at)`).
- **Límites:** el rango no puede superar los 366 días ni tener
  `fecha_inicio > fecha_fin`.
- **Respuestas:** `200` con el resumen · `400` con parámetros inválidos ·
  `401` sin token o token inválido · `403` con un rol distinto de admin ·
  `500` con mensaje genérico.
- **Formato:** `{ ok: true, mensaje: "Resumen del dashboard administrativo", data: { ... } }`.

Ejemplo con `?fecha_inicio=2026-10-16&fecha_fin=2026-10-22`:

```json
{
  "ok": true,
  "mensaje": "Resumen del dashboard administrativo",
  "data": {
    "rango": {
      "fechaInicio": "2026-10-16",
      "fechaFin": "2026-10-22",
      "dias": 7,
      "agrupacionRegistros": "dia"
    },
    "totales": {
      "usuarios": 89,
      "pendientes": 5,
      "medicosActivos": 1,
      "pacientes": 41,
      "consultoriosActivos": 1,
      "especialidadesActivas": 1,
      "citasHoy": 0,
      "citasMes": 0,
      "citasRango": 0
    },
    "usuariosPorRol": [
      { "rol": "admin", "total": 23 },
      { "rol": "medico", "total": 5 },
      { "rol": "paciente", "total": 61 }
    ],
    "usuariosPorEstado": [
      { "estado": "pendiente", "total": 5 },
      { "estado": "activo", "total": 79 },
      { "estado": "rechazado", "total": 5 }
    ],
    "registrosPorMes": [
      { "fecha": "2026-10-16", "etiqueta": "16 de Octubre", "total": 0 },
      { "fecha": "2026-10-17", "etiqueta": "17 de Octubre", "total": 0 }
    ],
    "medicosPorEspecialidad": [
      { "especialidad": "Cardiología", "total": 1 }
    ],
    "medicosPorConsultorio": [
      { "consultorio": "Consultorio Central", "total": 1 }
    ],
    "citasPorEstado": [
      { "estado": "pendiente", "total": 0 },
      { "estado": "confirmada", "total": 0 },
      { "estado": "reagendada", "total": 0 },
      { "estado": "cancelada", "total": 0 },
      { "estado": "completada", "total": 0 },
      { "estado": "no_asistio", "total": 0 }
    ],
    "citasPorDia": [
      { "fecha": "2026-10-16", "etiqueta": "16 de Octubre", "total": 0 },
      { "fecha": "2026-10-17", "etiqueta": "17 de Octubre", "total": 0 }
    ],
    "porcentajes": {
      "cuentasPendientes": 5.6,
      "citasConfirmadas": 0
    },
    "duracionPromedioCitas": 0,
    "duracionPromedioTexto": "0 h 0 min"
  }
}
```

> El ejemplo de `registrosPorMes` y `citasPorDia` está abreviado: la respuesta
> real incluye un elemento por cada día del rango solicitado.

#### Detalle de los campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `rango.fechaInicio` | string | Fecha inicial aplicada (`YYYY-MM-DD`) |
| `rango.fechaFin` | string | Fecha final aplicada (`YYYY-MM-DD`) |
| `rango.dias` | number | Días incluidos en el rango; máximo 366 |
| `rango.agrupacionRegistros` | string | `"dia"` si el rango tiene 60 días o menos; `"mes"` si tiene más |
| `totales.usuarios` | number | Usuarios con `deleted_at IS NULL` |
| `totales.pendientes` | number | Usuarios no eliminados con estado `pendiente` (por clave) |
| `totales.medicosActivos` | number | Médicos activos, no eliminados, con usuario no eliminado |
| `totales.pacientes` | number | Registros de paciente no eliminados con usuario no eliminado |
| `totales.consultoriosActivos` | number | Consultorios activos y no eliminados |
| `totales.especialidadesActivas` | number | Especialidades con `activo = true` |
| `totales.citasHoy` | number | Citas de hoy que además caen dentro del rango solicitado |
| `totales.citasMes` | number | Citas del mes actual que además caen dentro del rango solicitado |
| `totales.citasRango` | number | Citas con `fecha_hora` dentro del rango solicitado |
| `usuariosPorRol` | array | Todos los roles del catálogo, incluidos los que tengan cero |
| `usuariosPorEstado` | array | Todos los estados de cuenta, incluidos los que tengan cero |
| `registrosPorMes` | array | Altas de usuarios dentro del rango; usa `usuarios.created_at` y no deja huecos |
| `registrosPorMes[].fecha` | string | Presente solo cuando la agrupación es diaria (`YYYY-MM-DD`) |
| `registrosPorMes[].mes` | string | Presente solo cuando la agrupación es mensual (`YYYY-MM`) |
| `medicosPorEspecialidad` | array | Hasta 8 especialidades activas con médicos activos; orden descendente |
| `medicosPorConsultorio` | array | Consultorios activos con médicos activos; orden descendente |
| `citasPorEstado` | array | Todos los estados de cita del catálogo, incluidos los que tengan cero; cuenta solo las citas del rango |
| `citasPorDia` | array | Un elemento por cada día del rango, en orden y sin huecos |
| `porcentajes.cuentasPendientes` | number | Porcentaje de usuarios pendientes, redondeado a 1 decimal |
| `porcentajes.citasConfirmadas` | number | Porcentaje de citas confirmadas dentro del rango, redondeado a 1 decimal; 0 si no hay citas |
| `duracionPromedioCitas` | number | Promedio entero de `citas.duracion_minutos` en el rango; 0 si no hay citas |
| `duracionPromedioTexto` | string | Duración legible con formato `"X h Y min"`; `"0 h 0 min"` si no hay citas |

#### Reglas de cálculo

- El rango se interpreta como días completos: `fecha_hora >= fecha_inicio` y
  `fecha_hora < fecha_fin + INTERVAL '1 day'`.
- Las fechas inválidas, invertidas o con más de 366 días devuelven `400` con
  `{ ok: false, mensaje }`.
- Los porcentajes usan `NULLIF` para evitar divisiones entre cero y `ROUND(..., 1)` para dejar un decimal.
- La duración usa `ROUND`, `TRUNC` y `MOD`; el texto se construye con `CONCAT`.
- Las consultas de usuarios, médicos, pacientes y consultorios respetan `deleted_at`; `citas` y `especialidades` no tienen borrado lógico, por lo que se filtran por sus columnas de estado cuando aplica.
- Las 10 consultas se ejecutan en paralelo con `Promise.all` desde el caso de uso `ObtenerResumenAdmin`.
- **Endpoint retirado:** `GET /api/dashboard/stats`. Respondía sin token y con la forma antigua `{ ok, stats }`; se eliminó de `dashboard.routes.js` y ya no existe. Su reemplazo es `GET /api/dashboard/admin`, que exige rol admin y devuelve `{ ok, mensaje, data }`.

---

## Notas de implementación

- Todos los `500` registran con `console.error` y devuelven mensaje genérico (nunca `error.message` al cliente).
- Código `23505` PostgreSQL → 409 con mensaje diferenciado por campo.
- Los catálogos (`roles`, `estados_cuenta`, `estados_cita`) se referencian **por clave** en subconsultas, nunca por ID numérico fijo (RN-113).
- Borrado lógico (`deleted_at`) en todas las tablas de negocio; las consultas filtran `deleted_at IS NULL` (RN-110).
