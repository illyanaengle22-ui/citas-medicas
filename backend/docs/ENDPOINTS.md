# API Endpoints - Módulo de Usuarios

## Base URL
```
http://localhost:4000/api/usuarios
```

## Autenticación
Todos los endpoints requieren:
- Header `Authorization: Bearer <token JWT>`
- Rol de administrador (`rol_id = 1`)

---

## Endpoints

### 1. Listar usuarios
```http
GET /api/usuarios?rol=paciente&estado=activo&page=1&limit=10
```

**Parámetros query opcionales:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `rol` | string | Filtrar por rol: `admin`, `medico`, `paciente` |
| `estado` | string | Filtrar por estado: `pendiente`, `activo`, `rechazado` |
| `page` | number | Página actual (default: 1) |
| `limit` | number | Resultados por página (default: 10) |

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Lista de usuarios",
  "data": [
    {
      "id": 1,
      "uuid_publico": "uuid",
      "nombre": "Juan Pérez",
      "email": "juan@example.com",
      "rol": "paciente",
      "estado": "activo",
      "created_at": "2026-10-10T10:00:00Z"
    }
  ]
}
```

---

### 2. Listar usuarios pendientes
```http
GET /api/usuarios/pendientes
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Usuarios pendientes",
  "data": [
    {
      "id": 2,
      "uuid_publico": "uuid",
      "nombre": "María García",
      "email": "maria@example.com",
      "rol": "paciente",
      "estado": "pendiente",
      "created_at": "2026-10-10T10:00:00Z"
    }
  ]
}
```

---

### 3. Aprobar usuario
```http
PUT /api/usuarios/:id/aprobar
```

**Si el usuario tiene rol paciente, automáticamente crea su fila en la tabla `pacientes` dentro de una transacción.**

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Usuario aprobado correctamente"
}
```

**Respuesta 400 (no está pendiente):**
```json
{
  "ok": false,
  "mensaje": "El usuario no está pendiente"
}
```

---

### 4. Rechazar usuario
```http
DELETE /api/usuarios/:id/negar
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Cuenta rechazada correctamente"
}
```

---

### 5. Asignar rol
```http
PUT /api/usuarios/:id/rol
Content-Type: application/json

{
  "rol_id": 2
}
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Rol actualizado correctamente"
}
```

---

### 6. Estadísticas
```http
GET /api/usuarios/stats
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Estadísticas de usuarios",
  "data": {
    "totales": 156,
    "pendientes": 8,
    "activos": 140,
    "admins": 2,
    "medicos": 24,
    "pacientes": 128
  }
}
```

---

### 7. Crear usuario (admin)
```http
POST /api/usuarios
Content-Type: application/json

{
  "nombre": "Nuevo Usuario",
  "email": "nuevo@example.com",
  "password": "Clave123!",
  "rol_id": 2
}
```

**Respuesta 201:**
```json
{
  "ok": true,
  "mensaje": "Usuario creado correctamente",
  "data": {
    "id": 10,
    "uuid_publico": "uuid",
    "nombre": "Nuevo Usuario",
    "email": "nuevo@example.com",
    "rol_id": 2,
    "estado_id": 2,
    "created_at": "2026-10-10T10:00:00Z"
  }
}
```

**Respuesta 409 (email duplicado):**
```json
{
  "ok": false,
  "mensaje": "El email ya está registrado"
}
```

---

### 8. Actualizar usuario
```http
PUT /api/usuarios/:id
Content-Type: application/json

{
  "nombre": "Nombre Actualizado",
  "email": "nuevoemail@example.com",
  "rol_id": 2
}
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Usuario actualizado correctamente",
  "data": {
    "id": 10,
    "uuid_publico": "uuid",
    "nombre": "Nombre Actualizado",
    "email": "nuevoemail@example.com",
    "rol_id": 2,
    "estado_id": 2,
    "updated_at": "2026-10-10T10:00:00Z"
  }
}
```

---

### 9. Eliminar usuario (soft delete)
```http
DELETE /api/usuarios/:id
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Usuario eliminado correctamente"
}
```

**Respuesta 400 (auto-eliminación):**
```json
{
  "ok": false,
  "mensaje": "No puedes eliminar tu propia cuenta"
}
```

---

# API Endpoints - Módulo de Especialidades

## Base URL
```
http://localhost:4000/api/especialidades
```

## Autenticación
- **GET**: cualquier usuario autenticado (requiere `Authorization: Bearer <token>`)
- **POST, PUT, PATCH**: solo administradores (rol `admin`)

---

## Endpoints

### 1. Listar especialidades
```http
GET /api/especialidades
GET /api/especialidades?todas=true
```

**Parámetros query opcionales:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `todas` | string | Si es `true` y el usuario es admin, incluye especialidades inactivas (RN-031) |

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Lista de especialidades",
  "data": [
    { "id": 1, "nombre": "Cardiología", "descripcion": "Estudio y tratamiento del corazón", "activo": true },
    { "id": 2, "nombre": "Neurología", "descripcion": null, "activo": true }
  ]
}
```

---

### 2. Obtener especialidad por ID
```http
GET /api/especialidades/:id
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Especialidad encontrada",
  "data": { "id": 1, "nombre": "Cardiología", "descripcion": "Estudio y tratamiento del corazón", "activo": true }
}
```

**Respuesta 400 (ID inválido):**
```json
{ "ok": false, "mensaje": "ID inválido" }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Especialidad no encontrada" }
```

---

### 3. Crear especialidad
```http
POST /api/especialidades
Content-Type: application/json

{ "nombre": "Cardiología", "descripcion": "Estudio y tratamiento del corazón" }
```

**Respuesta 201:**
```json
{
  "ok": true,
  "mensaje": "Especialidad creada correctamente",
  "data": { "id": 3, "nombre": "Cardiología", "descripcion": "Estudio y tratamiento del corazón", "activo": true }
}
```

**Respuesta 400 (nombre vacío):**
```json
{ "ok": false, "mensaje": "nombre es requerido" }
```

**Respuesta 400 (descripción demasiado larga, RN-030b):**
```json
{ "ok": false, "mensaje": "La descripción no puede superar los 500 caracteres" }
```

**Respuesta 409 (duplicado, case-insensitive):**
```json
{ "ok": false, "mensaje": "Ya existe una especialidad con ese nombre" }
```

---

### 4. Actualizar especialidad (nombre y descripción)
```http
PUT /api/especialidades/:id
Content-Type: application/json

{ "nombre": "Cardiología Pediátrica", "descripcion": "Cardiología para niños" }
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Especialidad actualizada correctamente",
  "data": { "id": 1, "nombre": "Cardiología Pediátrica", "descripcion": "Cardiología para niños", "activo": true }
}
```

**Respuesta 400 (nombre vacío):**
```json
{ "ok": false, "mensaje": "nombre es requerido y no puede estar vacío" }
```

**Respuesta 400 (descripción demasiado larga, RN-030b):**
```json
{ "ok": false, "mensaje": "La descripción no puede superar los 500 caracteres" }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Especialidad no encontrada" }
```

**Respuesta 409 (duplicado):**
```json
{ "ok": false, "mensaje": "Ya existe una especialidad con ese nombre" }
```

---

### 5. Cambiar estado (activar/desactivar)
```http
PATCH /api/especialidades/:id/estado
Content-Type: application/json

{ "activo": false }
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Especialidad desactivada",
  "data": { "id": 1, "nombre": "Cardiología", "descripcion": null, "activo": false }
}
```

**Respuesta 400 (activo no booleano):**
```json
{ "ok": false, "mensaje": "\"activo\" debe ser true o false" }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Especialidad no encontrada" }
```

---

# API Endpoints - Módulo de Usuarios

## Base URL
```
http://localhost:4000/api/usuarios
```

## Autenticación
Todos los endpoints requieren:
- Header `Authorization: Bearer <token JWT>`
- Rol de administrador (`rol_id = 1`)

---

## Endpoints

### 1. Listar usuarios
```http
GET /api/usuarios?rol=admin&estado=activo&q=juan&page=1&limit=10
```

**Parámetros query opcionales:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `rol` | string | Filtrar por rol: `admin`, `medico`, `paciente` |
| `estado` | string | Filtrar por estado: `pendiente`, `activo`, `rechazado` |
| `q` | string | Buscar en nombre y email (case-insensitive) |
| `page` | number | Página actual (default: 1) |
| `limit` | number | Resultados por página (default: 10) |

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Lista de usuarios",
  "data": {
    "data": [
      {
        "id": 1,
        "uuid_publico": "uuid",
        "nombre": "Juan Pérez",
        "email": "juan@example.com",
        "rol": "paciente",
        "estado": "activo",
        "created_at": "2026-10-10T10:00:00Z",
        "ultimo_login": null
      }
    ],
    "total": 156,
    "page": 1,
    "limit": 10
  }
}
```

---

### 2. Obtener usuario por ID
```http
GET /api/usuarios/:id
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Usuario encontrado",
  "data": {
    "id": 1,
    "uuid_publico": "uuid",
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "rol": "paciente",
    "estado": "activo",
    "created_at": "2026-10-10T10:00:00Z",
    "ultimo_login": "2026-10-12T15:30:00Z"
  }
}
```

**Respuesta 400 (ID inválido):**
```json
{ "ok": false, "mensaje": "ID inválido" }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Usuario no encontrado" }
```

---

### 3. Listar usuarios pendientes
```http
GET /api/usuarios/pendientes
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Usuarios pendientes",
  "data": [
    {
      "id": 2,
      "uuid_publico": "uuid",
      "nombre": "María García",
      "email": "maria@example.com",
      "rol": "paciente",
      "estado": "pendiente",
      "created_at": "2026-10-10T10:00:00Z"
    }
  ]
}
```

---

### 4. Estadísticas
```http
GET /api/usuarios/stats
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Estadísticas de usuarios",
  "data": {
    "totales": 156,
    "pendientes": 8,
    "activos": 140,
    "admins": 2,
    "medicos": 24,
    "pacientes": 128
  }
}
```

---

### 5. Crear usuario (admin)
```http
POST /api/usuarios
Content-Type: application/json

{
  "nombre": "Nuevo Usuario",
  "email": "nuevo@example.com",
  "password": "Clave123!",
  "rol_id": 3
}
```

**Roles permitidos:** `1` (admin), `3` (paciente). Rol `2` (médico) → 400 "Los médicos se crean desde el módulo Médicos".

**Respuesta 201:**
```json
{
  "ok": true,
  "mensaje": "Usuario creado correctamente",
  "data": {
    "id": 10,
    "uuid_publico": "uuid",
    "nombre": "Nuevo Usuario",
    "email": "nuevo@example.com",
    "rol_id": 3,
    "estado_id": 2,
    "created_at": "2026-10-10T10:00:00Z"
  }
}
```

**Respuesta 400 (rol médico):**
```json
{ "ok": false, "mensaje": "Los médicos se crean desde el módulo Médicos" }
```

**Respuesta 409 (email duplicado):**
```json
{ "ok": false, "mensaje": "El email ya está registrado" }
```

---

### 6. Actualizar usuario
```http
PUT /api/usuarios/:id
Content-Type: application/json

{
  "nombre": "Nombre Actualizado",
  "email": "nuevoemail@example.com",
  "password": "NuevaClave123"
}
```

**Campos opcionales:** `nombre`, `email`, `password` (mínimo 8 caracteres). `rol_id` no se actualiza aquí (usa endpoint de rol).

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Usuario actualizado correctamente",
  "data": {
    "id": 10,
    "uuid_publico": "uuid",
    "nombre": "Nombre Actualizado",
    "email": "nuevoemail@example.com",
    "rol_id": 3,
    "estado_id": 2,
    "updated_at": "2026-10-10T10:00:00Z"
  }
}
```

**Respuesta 400 (password corto):**
```json
{ "ok": false, "mensaje": "La contraseña debe tener al menos 8 caracteres" }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Usuario no encontrado" }
```

**Respuesta 409 (email duplicado):**
```json
{ "ok": false, "mensaje": "El email ya está registrado" }
```

---

### 7. Cambiar rol
```http
PUT /api/usuarios/:id/rol
Content-Type: application/json

{
  "rol_id": 3
}
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Rol actualizado correctamente"
}
```

**Respuesta 400 (auto-cambio):**
```json
{ "ok": false, "mensaje": "No puedes cambiar tu propio rol" }
```

**Respuesta 409 (rol médico bloqueado):**
```json
{ "ok": false, "mensaje": "No se puede cambiar el rol hacia o desde médico. Use el módulo de Médicos." }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Usuario no encontrado" }
```

---

### 8. Eliminar usuario (soft delete)
```http
DELETE /api/usuarios/:id
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Usuario eliminado correctamente"
}
```

**Respuesta 400 (auto-eliminación):**
```json
{ "ok": false, "mensaje": "No puedes eliminar tu propia cuenta" }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Usuario no encontrado" }
```

---

### 9. Aprobar usuario
```http
PUT /api/usuarios/:id/aprobar
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Usuario aprobado correctamente"
}
```

**Respuesta 400 (no pendiente):**
```json
{ "ok": false, "mensaje": "El usuario no está pendiente" }
```

---

### 10. Rechazar usuario
```http
DELETE /api/usuarios/:id/negar
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Cuenta rechazada correctamente"
}
```

---

## Códigos de error comunes

| Código | Significado |
|--------|-------------|
| 400 | Datos inválidos (ID no entero, nombre vacío, password < 8 chars, rol inválido) |
| 401 | Token no proporcionado o inválido |
| 403 | Rol no autorizado (solo admin), cuenta pendiente/rechazada/eliminada, auto-eliminación/auto-cambio de rol |
| 404 | Usuario no encontrado |
| 409 | Email duplicado (case-insensitive), cambio de rol a/desde médico |
| 500 | Error interno del servidor |

---

# API Endpoints - Módulo de Consultorios

## Base URL
```
http://localhost:4000/api/consultorios
```

## Autenticación (RN-034)
- **GET**: cualquier usuario autenticado (requiere `Authorization: Bearer <token>`)
- **POST, PUT, PATCH, DELETE**: solo administradores (rol `admin`)

> **Nota de tipos:** `consultorios.id` es `BIGINT`, por lo que se devuelve como **string** en JSON (igual que `usuarios.id`). Todos los `id` de este módulo son strings de dígitos.

---

## Endpoints

### 1. Listar consultorios
```http
GET /api/consultorios
GET /api/consultorios?todos=true&q=centro
```

**Parámetros query opcionales:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `todos` | string | Si es `true` y el usuario es admin, incluye consultorios inactivos. Un no-admin lo ignora |
| `q` | string | Busca en `nombre` y `direccion` (case-insensitive) |

Por defecto devuelve solo consultorios **activos y no eliminados**, ordenados por nombre.

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Lista de consultorios",
  "data": [
    {
      "id": "1",
      "nombre": "Consultorio Central",
      "direccion": "Av. Principal 123",
      "telefono": "5551234567",
      "activo": true,
      "created_at": "2026-10-10T10:00:00Z"
    }
  ]
}
```

---

### 2. Obtener consultorio por ID
```http
GET /api/consultorios/:id
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Consultorio encontrado",
  "data": {
    "id": "1",
    "nombre": "Consultorio Central",
    "direccion": "Av. Principal 123",
    "telefono": "5551234567",
    "activo": true,
    "created_at": "2026-10-10T10:00:00Z"
  }
}
```

**Respuesta 400 (ID inválido):**
```json
{ "ok": false, "mensaje": "ID inválido" }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Consultorio no encontrado" }
```

---

### 3. Crear consultorio
```http
POST /api/consultorios
Content-Type: application/json

{
  "nombre": "Consultorio Central",
  "direccion": "Av. Principal 123",
  "telefono": "555-123-4567"
}
```

**Reglas (RN-032):**
- `nombre` y `direccion` son **obligatorios**; se recortan y se colapsan espacios dobles.
- `telefono` es opcional. Se guardan **solo los dígitos** (se quitan guiones, espacios y paréntesis) y debe tener **entre 7 y 15 dígitos**.
- El nombre no puede repetirse entre consultorios no eliminados (comparación sin mayúsculas).

**Respuesta 201:**
```json
{
  "ok": true,
  "mensaje": "Consultorio creado correctamente",
  "data": {
    "id": "2",
    "nombre": "Consultorio Central",
    "direccion": "Av. Principal 123",
    "telefono": "5551234567",
    "activo": true,
    "created_at": "2026-10-10T10:00:00Z"
  }
}
```

**Respuesta 400 (campos obligatorios):**
```json
{ "ok": false, "mensaje": "El campo nombre es requerido" }
{ "ok": false, "mensaje": "El campo direccion es requerido" }
```

**Respuesta 400 (teléfono inválido):**
```json
{ "ok": false, "mensaje": "El teléfono debe tener entre 7 y 15 dígitos" }
```

**Respuesta 409 (nombre duplicado):**
```json
{ "ok": false, "mensaje": "Ya existe un consultorio con ese nombre" }
```

---

### 4. Actualizar consultorio
```http
PUT /api/consultorios/:id
Content-Type: application/json

{
  "nombre": "Consultorio Central Renombrado",
  "direccion": "Av. Principal 456",
  "telefono": "5559876543"
}
```

Mismos campos y validaciones que la creación (`nombre` y `direccion` obligatorios). Un `telefono` vacío se guarda como `null`.

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Consultorio actualizado correctamente",
  "data": {
    "id": "2",
    "nombre": "Consultorio Central Renombrado",
    "direccion": "Av. Principal 456",
    "telefono": "5559876543",
    "activo": true,
    "created_at": "2026-10-10T10:00:00Z"
  }
}
```

**Respuesta 400 / 404 / 409:** iguales que en la creación.

---

### 5. Cambiar estado (activar/desactivar)
```http
PATCH /api/consultorios/:id/estado
Content-Type: application/json

{ "activo": false }
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Consultorio desactivado",
  "data": {
    "id": "2",
    "nombre": "Consultorio Central",
    "direccion": "Av. Principal 123",
    "telefono": "5551234567",
    "activo": false,
    "created_at": "2026-10-10T10:00:00Z"
  }
}
```

**Respuesta 400 (activo no booleano):**
```json
{ "ok": false, "mensaje": "\"activo\" debe ser true o false" }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Consultorio no encontrado" }
```

---

### 6. Eliminar consultorio (soft delete)
```http
DELETE /api/consultorios/:id
```

**RN-033:** borrado lógico (`deleted_at = now()`); nunca se borra físicamente. El nombre queda libre para reutilizarse.

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Consultorio eliminado correctamente",
  "data": { "id": "2" }
}
```

**Respuesta 409 (tiene citas futuras vigentes):**
```json
{ "ok": false, "mensaje": "El consultorio tiene citas pendientes" }
```

**Respuesta 404:**
```json
{ "ok": false, "mensaje": "Consultorio no encontrado" }
```

---

## Índice único recomendado (RN-114)

Actualmente la tabla `consultorios` **no** tiene índice único parcial para el nombre. Para reforzar la unicidad en la base:

```sql
CREATE UNIQUE INDEX ux_consultorios_nombre_activo
  ON consultorios (lower(nombre))
  WHERE deleted_at IS NULL;
```

> Avisar al compañero antes de aplicar cualquier `ALTER` (RN-114). El backend ya valida la unicidad sin mayúsculas, por lo que el sistema funciona correctamente aunque el índice aún no exista.
