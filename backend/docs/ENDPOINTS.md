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
    { "id": 1, "nombre": "Cardiología", "activo": true },
    { "id": 2, "nombre": "Neurología", "activo": true }
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
  "data": { "id": 1, "nombre": "Cardiología", "activo": true }
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

{ "nombre": "Cardiología" }
```

**Respuesta 201:**
```json
{
  "ok": true,
  "mensaje": "Especialidad creada correctamente",
  "data": { "id": 3, "nombre": "Cardiología", "activo": true }
}
```

**Respuesta 400 (nombre vacío):**
```json
{ "ok": false, "mensaje": "nombre es requerido" }
```

**Respuesta 409 (duplicado, case-insensitive):**
```json
{ "ok": false, "mensaje": "Ya existe una especialidad con ese nombre" }
```

---

### 4. Actualizar especialidad (solo nombre)
```http
PUT /api/especialidades/:id
Content-Type: application/json

{ "nombre": "Cardiología Pediátrica" }
```

**Respuesta 200:**
```json
{
  "ok": true,
  "mensaje": "Especialidad actualizada correctamente",
  "data": { "id": 1, "nombre": "Cardiología Pediátrica", "activo": true }
}
```

**Respuesta 400 (nombre vacío):**
```json
{ "ok": false, "mensaje": "nombre es requerido y no puede estar vacío" }
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
  "data": { "id": 1, "nombre": "Cardiología", "activo": false }
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

## Códigos de error comunes

| Código | Significado |
|--------|-------------|
| 400 | Datos inválidos (ID no entero, nombre vacío, activo no booleano) |
| 401 | Token no proporcionado o inválido |
| 403 | Rol no autorizado (solo admin para POST/PUT/PATCH) |
| 404 | Especialidad no encontrada |
| 409 | Nombre duplicado (case-insensitive) |
| 500 | Error interno del servidor |
