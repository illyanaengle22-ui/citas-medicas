# Auditoría SQL — Sistema de Citas Médicas

**Alcance:** `backend/src/infrastructure/adapters/` y `backend/src/application/use-cases/`.
**Objetivo:** demostrar el uso de consultas SQL complejas y documentar las mejoras de nivel avanzado incorporadas al backend.

> Las líneas indicadas son aproximadas y pueden desplazarse si el archivo cambia. La referencia principal es el nombre del método y el archivo.

---

## 1. Matriz de cobertura de las 9 categorías

| # | Categoría | ¿Cumple? | Archivo | Línea aprox. | Evidencia / método |
|---|-----------|----------|---------|--------------|--------------------|
| 1 | Selección con columnas específicas | Sí | `backend/src/infrastructure/adapters/PostgresCitaRepository.js` | 42–58 | `obtenerPorId` selecciona columnas explícitas, sin `SELECT *`. |
| 2 | Proyección con alias (`AS`) | Sí | `backend/src/infrastructure/adapters/PostgresCitaRepository.js` | 46–47 | `ec.clave AS estado`, `up.nombre AS paciente_nombre`, etc. |
| 3 | Uniones (`JOIN`, `LEFT JOIN`) | Sí | `backend/src/infrastructure/adapters/PostgresCitaRepository.js` | 48–54 | `JOIN estados_cita` y varios `LEFT JOIN` con `deleted_at IS NULL`. |
| 4 | Subconsultas / `EXISTS` | Sí | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 10–52 | Subconsultas escalares para las métricas del dashboard. |
| 4 | Subconsultas / `EXISTS` | Sí | `backend/src/infrastructure/adapters/PostgresHorarioRepository.js` | 83–100 | `EXISTS` para validar médico, consultorio y especialidad activos. |
| 4 | Subconsultas / `EXISTS` | Sí | `backend/src/infrastructure/adapters/PostgresRecordatorioRepository.js` | 66–68 | `NOT EXISTS` para no duplicar recordatorios. |
| 5 | `ORDER BY` | Sí | `backend/src/infrastructure/adapters/PostgresCitaRepository.js` | 120 | `ORDER BY c.fecha_hora ASC`. |
| 5 | `ORDER BY` | Sí | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 145, 187 | Orden por métrica y nombre: `ORDER BY total DESC, ... ASC`. |
| 6 | Funciones numéricas | Sí | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 311–315, 327 | `ROUND`, `AVG`, `NULLIF`, `COALESCE`. |
| 6 | Funciones numéricas | Sí | `backend/src/infrastructure/adapters/PostgresUsuarioRepository.js` | 198–203 | `COUNT(*)` y `COUNT(*) FILTER (WHERE ...)`. |
| 7 | Funciones de caracteres | Sí | `backend/src/infrastructure/adapters/PostgresConsultorioRepository.js` | 41, 62 | `LOWER` e `ILIKE`. |
| 7 | Funciones de caracteres | Sí | `backend/src/infrastructure/adapters/PostgresMedicoRepository.js` | 151 | `ILIKE` sobre nombre y cédula. |
| 7 | Funciones de caracteres | Sí | `backend/src/infrastructure/adapters/PostgresUsuarioRepository.js` | 24 | `ILIKE` sobre nombre y correo. |
| 7 | Funciones de caracteres | Sí | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 95–96, 334–339 | `TO_CHAR`, `TRIM`, `CONCAT`. |
| 8 | Funciones de fecha (bonus) | Sí | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 39–46, 88–91, 112–113 | `CURRENT_DATE`, `NOW()`, `DATE_TRUNC`, `INTERVAL`, `GENERATE_SERIES`. |
| 8 | Funciones de fecha (bonus) | Sí | `backend/src/infrastructure/adapters/PostgresRecordatorioRepository.js` | 64–65 | `now() + ($1 || ' hours')::interval`. |
| 8 | Funciones de fecha (bonus) | Sí | `backend/src/infrastructure/adapters/PostgresHorarioRepository.js` | 165, 204–210 | `EXTRACT(ISODOW ...)` y `AT TIME ZONE`. |
| 9 | Precedencia con paréntesis | Sí | `backend/src/infrastructure/adapters/PostgresConsultorioRepository.js` | 62 | `(nombre ILIKE $1 OR direccion ILIKE $1)`. |
| 9 | Precedencia con paréntesis | Sí | `backend/src/infrastructure/adapters/PostgresMedicoRepository.js` | 151 | `(u.nombre ILIKE $1 OR m.cedula_profesional ILIKE $1)`. |
| 9 | Precedencia con paréntesis | Sí | `backend/src/infrastructure/adapters/PostgresUsuarioRepository.js` | 24 | `(u.nombre ILIKE $1 OR u.email ILIKE $1)`. |
| 9 | Precedencia con paréntesis | Sí | `backend/src/application/use-cases/VincularTelegram.js` | 250–251 | `($1::bigint IS NULL OR id = $1)` y `($2::text IS NULL OR telegram_chat_id = $2)`. |

---

## 2. Evidencia SQL representativa

### 2.1 Selección y proyección

`PostgresCitaRepository.js` — `obtenerPorId`:

```sql
SELECT c.id, c.uuid_publico, c.paciente_id, c.medico_id, c.consultorio_id, c.fecha_hora,
       c.duracion_minutos, c.fecha_fin, c.estado_id, c.motivo, c.notas, c.created_at, c.updated_at,
       ec.clave AS estado,
       up.nombre AS paciente_nombre, um.nombre AS medico_nombre, co.nombre AS consultorio_nombre
FROM citas c
...
WHERE c.id = $1
```

### 2.2 Uniones

`PostgresCitaRepository.js` — `obtenerPorId`:

```sql
FROM citas c
JOIN estados_cita ec ON ec.id = c.estado_id
LEFT JOIN pacientes p ON p.id = c.paciente_id AND p.deleted_at IS NULL
LEFT JOIN usuarios up ON up.id = p.usuario_id AND up.deleted_at IS NULL
LEFT JOIN medicos m ON m.id = c.medico_id AND m.deleted_at IS NULL
LEFT JOIN usuarios um ON um.id = m.usuario_id AND um.deleted_at IS NULL
LEFT JOIN consultorios co ON co.id = c.consultorio_id AND co.deleted_at IS NULL
```

### 2.3 Subconsultas y `EXISTS`

`PostgresDashboardRepository.js` — `obtenerTotales`:

```sql
SELECT
  (SELECT COUNT(*)::int
     FROM usuarios
    WHERE deleted_at IS NULL) AS usuarios,
  (SELECT COUNT(*)::int
     FROM citas
    WHERE fecha_hora >= CURRENT_DATE
      AND fecha_hora < CURRENT_DATE + INTERVAL '1 day') AS "citasHoy"
```

`PostgresHorarioRepository.js` — `listarPorMedico`:

```sql
EXISTS (
  SELECT 1 FROM medicos m
  JOIN usuarios u ON u.id = m.usuario_id
  JOIN estados_cuenta ec ON ec.id = u.estado_id
  WHERE m.id = h.medico_id
    AND m.deleted_at IS NULL AND m.activo = true
    AND u.deleted_at IS NULL AND ec.clave = 'activo'
)
```

`PostgresRecordatorioRepository.js` — recordatorios pendientes:

```sql
AND NOT EXISTS (
  SELECT 1 FROM recordatorios r
  WHERE r.cita_id = c.id AND r.tipo = $2
)
```

### 2.4 Ordenamiento y funciones numéricas

`PostgresCitaRepository.js`:

```sql
ORDER BY c.fecha_hora ASC
```

`PostgresDashboardRepository.js`:

```sql
COALESCE(
  ROUND(100.0 * u.pendientes / NULLIF(u.total, 0), 1),
  0
)::float8 AS "cuentasPendientes"
```

```sql
SELECT COALESCE(ROUND(AVG(duracion_minutos)), 0)::int AS minutos
```

`PostgresUsuarioRepository.js`:

```sql
COUNT(*) AS totales,
COUNT(*) FILTER (WHERE estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'pendiente')) AS pendientes,
COUNT(*) FILTER (WHERE estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'activo')) AS activos
```

### 2.5 Funciones de caracteres

`PostgresConsultorioRepository.js`:

```sql
(nombre ILIKE $1 OR direccion ILIKE $1)
```

`PostgresDashboardRepository.js`:

```sql
to_char(d.dia, 'YYYY-MM-DD') AS fecha,
trim(to_char(d.dia, 'TMDD "de" TMMonth')) AS etiqueta
```

```sql
CONCAT(
  TRUNC(minutos / 60.0)::int,
  ' h ',
  MOD(minutos, 60),
  ' min'
) AS "duracionPromedioTexto"
```

### 2.6 Funciones de fecha

`PostgresDashboardRepository.js`:

```sql
WHERE fecha_hora >= CURRENT_DATE
  AND fecha_hora < CURRENT_DATE + INTERVAL '1 day'
```

```sql
WHERE fecha_hora >= date_trunc('month', now())
  AND fecha_hora < date_trunc('month', now()) + INTERVAL '1 month'
```

```sql
WITH dias AS (
  SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS dia
)
```

`PostgresRecordatorioRepository.js`:

```sql
AND c.fecha_hora <= now() + ($1 || ' hours')::interval
```

`PostgresHorarioRepository.js`:

```sql
SELECT EXTRACT(ISODOW FROM $1::date)::int AS dia
```

```sql
to_char(fecha_hora AT TIME ZONE $3, 'HH24:MI:SS') AS hora_inicio
```

### 2.7 Precedencia con paréntesis

`PostgresConsultorioRepository.js`:

```sql
(nombre ILIKE $1 OR direccion ILIKE $1)
```

`VincularTelegram.js`:

```sql
AND ($1::bigint IS NULL OR id = $1)
AND ($2::text IS NULL OR telegram_chat_id = $2)
```

Los paréntesis evitan que el `AND` se evalúe antes que el `OR` y cambie el resultado.

---

## 3. Mejoras de Nivel Avanzado

Se agregaron cuatro consultas nuevas en los adaptadores PostgreSQL. No se modificaron el frontend, los controladores ni los casos de uso; las consultas quedan disponibles como métodos de repositorio para ser consumidas cuando se requiera.

### 3.1 `GROUP BY` + `HAVING`

**Archivo:** `backend/src/infrastructure/adapters/PostgresDashboardRepository.js`  
**Método:** `obtenerEspecialidadesConMasDeUnMedico()`  
**Líneas:** 151–170

**Objetivo:** listar únicamente las especialidades que tienen más de un médico activo.

```sql
SELECT e.id,
       e.nombre AS especialidad,
       COUNT(DISTINCT m.id)::int AS total_medicos
  FROM especialidades e
  JOIN medico_especialidades me ON me.especialidad_id = e.id
  JOIN medicos m ON m.id = me.medico_id
  JOIN usuarios u ON u.id = m.usuario_id
 WHERE e.activo = TRUE
   AND m.deleted_at IS NULL
   AND m.activo = TRUE
   AND u.deleted_at IS NULL
 GROUP BY e.id, e.nombre
HAVING COUNT(DISTINCT m.id) > 1
 ORDER BY total_medicos DESC, especialidad ASC;
```

**Explicación:** `GROUP BY` agrupa por especialidad y `HAVING` filtra los grupos después de calcular `COUNT(DISTINCT m.id)`. Si ninguna especialidad cumple la condición, la consulta devuelve una lista vacía.

---

### 3.2 Función de ventana: `ROW_NUMBER() OVER (...)`

**Archivo:** `backend/src/infrastructure/adapters/PostgresCitaRepository.js`  
**Método:** `listarCitasNumeradasPorMedico({ medico_id, fechaInicio, fechaFin })`  
**Líneas:** 128–152

**Objetivo:** numerar las citas de cada médico en orden cronológico, empezando en 1 para cada médico.

```sql
SELECT c.id,
       c.medico_id,
       um.nombre AS medico,
       c.fecha_hora,
       to_char(c.fecha_hora AT TIME ZONE $3, 'YYYY-MM-DD HH24:MI') AS fecha_local,
       ec.clave AS estado,
       (ROW_NUMBER() OVER (
         PARTITION BY c.medico_id
         ORDER BY c.fecha_hora ASC
       ))::int AS numero_cita
  FROM citas c
  JOIN medicos m ON m.id = c.medico_id AND m.deleted_at IS NULL
  JOIN usuarios um ON um.id = m.usuario_id AND um.deleted_at IS NULL
  JOIN estados_cita ec ON ec.id = c.estado_id
 WHERE ($1::bigint IS NULL OR c.medico_id = $1)
   AND ($2::date IS NULL OR (c.fecha_hora AT TIME ZONE $3)::date >= $2::date)
   AND ($4::date IS NULL OR (c.fecha_hora AT TIME ZONE $3)::date <= $4::date)
 ORDER BY c.medico_id ASC, numero_cita ASC;
```

**Explicación:** `PARTITION BY c.medico_id` reinicia la numeración para cada médico y `ORDER BY c.fecha_hora ASC` define el orden de las citas. Los parámetros opcionales permiten filtrar por médico y por rango de fechas sin duplicar consultas.

---

### 3.3 `UNION ALL`

**Archivo:** `backend/src/infrastructure/adapters/PostgresDashboardRepository.js`  
**Método:** `obtenerCitasMananaTarde(fechaInicio, fechaFin)`  
**Líneas:** 229–264

**Objetivo:** devolver en una sola tabla las citas de la mañana y las de la tarde, identificando la franja en una columna.

```sql
SELECT 'Mañana' AS franja,
       1 AS orden_franja,
       c.id,
       c.fecha_hora,
       to_char(c.fecha_hora AT TIME ZONE $3, 'YYYY-MM-DD HH24:MI') AS fecha_local,
       um.nombre AS medico,
       ec.clave AS estado
  FROM citas c
  JOIN medicos m ON m.id = c.medico_id AND m.deleted_at IS NULL
  JOIN usuarios um ON um.id = m.usuario_id AND um.deleted_at IS NULL
  JOIN estados_cita ec ON ec.id = c.estado_id
 WHERE (c.fecha_hora AT TIME ZONE $3)::date >= $1::date
   AND (c.fecha_hora AT TIME ZONE $3)::date <= $2::date
   AND EXTRACT(HOUR FROM c.fecha_hora AT TIME ZONE $3) < 12
UNION ALL
SELECT 'Tarde' AS franja,
       2 AS orden_franja,
       c.id,
       c.fecha_hora,
       to_char(c.fecha_hora AT TIME ZONE $3, 'YYYY-MM-DD HH24:MI') AS fecha_local,
       um.nombre AS medico,
       ec.clave AS estado
  FROM citas c
  JOIN medicos m ON m.id = c.medico_id AND m.deleted_at IS NULL
  JOIN usuarios um ON um.id = m.usuario_id AND um.deleted_at IS NULL
  JOIN estados_cita ec ON ec.id = c.estado_id
 WHERE (c.fecha_hora AT TIME ZONE $3)::date >= $1::date
   AND (c.fecha_hora AT TIME ZONE $3)::date <= $2::date
   AND EXTRACT(HOUR FROM c.fecha_hora AT TIME ZONE $3) >= 12
 ORDER BY orden_franja, fecha_hora;
```

**Explicación:** `UNION ALL` conserva todas las filas de ambas consultas (no elimina duplicados) y es más eficiente que `UNION`. La columna `orden_franja` permite ordenar primero la mañana y luego la tarde. La hora se interpreta en la zona horaria de la clínica con `AT TIME ZONE`.

---

### 3.4 `CASE WHEN`

**Archivo:** `backend/src/infrastructure/adapters/PostgresDashboardRepository.js`  
**Método:** `obtenerCitasPorFranjaHoraria(fechaInicio, fechaFin)`  
**Líneas:** 266–289

**Objetivo:** clasificar las citas en `Mañana`, `Tarde` o `Noche` y contar cuántas hay en cada franja.

```sql
SELECT franja, COUNT(*)::int AS total
FROM (
  SELECT
    CASE
      WHEN EXTRACT(HOUR FROM c.fecha_hora AT TIME ZONE $3) < 12 THEN 'Mañana'
      WHEN EXTRACT(HOUR FROM c.fecha_hora AT TIME ZONE $3) < 18 THEN 'Tarde'
      ELSE 'Noche'
    END AS franja
  FROM citas c
  WHERE (c.fecha_hora AT TIME ZONE $3)::date >= $1::date
    AND (c.fecha_hora AT TIME ZONE $3)::date <= $2::date
) clasificadas
GROUP BY franja
ORDER BY CASE franja
           WHEN 'Mañana' THEN 1
           WHEN 'Tarde' THEN 2
           ELSE 3
         END;
```

**Explicación:** `CASE WHEN` transforma la hora de la cita en una etiqueta legible. La subconsulta permite agrupar por el alias `franja` sin repetir la expresión, y el `ORDER BY` con `CASE` garantiza el orden cronológico de las franjas (mañana, tarde, noche).

---

## 4. Resumen de archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | Se agregaron las consultas con `HAVING`, `UNION ALL` y `CASE WHEN`. |
| `backend/src/infrastructure/adapters/PostgresCitaRepository.js` | Se agregó la consulta con `ROW_NUMBER() OVER (...)`. |
| `docs/AUDITORIA_SQL.md` | Documento de entrega con la matriz de cobertura y las mejoras avanzadas. |

**Nota:** las consultas nuevas son de solo lectura (`SELECT`) y no alteran el esquema ni los datos existentes.
