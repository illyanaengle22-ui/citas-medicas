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
