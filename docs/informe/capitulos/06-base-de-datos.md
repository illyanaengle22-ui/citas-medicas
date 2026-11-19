# Base de datos

La capa de datos se implementó sobre **PostgreSQL 14+**, delegando la aplicación de restricciones de concurrencia y auditoría directamente al motor relacional para asegurar la consistencia transaccional.

## Modelo entidad-relación (ERD)

El esquema consta de 15 tablas divididas entre catálogos normalizados (`roles`, `estados_cuenta`, `estados_cita`, `especialidades`), entidades maestras (`usuarios`, `pacientes`, `medicos`, `consultorios`), tablas de enlace N:M (`medico_especialidades`, `medico_consultorios`) y tablas transaccionales (`horarios`, `citas`, `historial_estados_cita`, `recordatorios`, `telegram_codigos`).

La Figura 3 detalla las relaciones y tipos de datos del esquema.

![Figura 3. Diagrama Entidad-Relación de la base de datos de MediCitas.](img/erd.png)

## Restricciones avanzadas de integridad

### Restricciones CHECK

* `chk_horarios_dia_semana`: Garantiza `dia_semana BETWEEN 1 AND 7` (norma ISO 8601).
* `chk_horarios_rango`: Exige `hora_fin > hora_inicio`.
* `chk_citas_duracion`: Acota la consulta con `duracion_minutos BETWEEN 10 AND 240`.
* `chk_citas_fecha_futura_al_crear`: Impide citas en el pasado con `fecha_hora > created_at - INTERVAL '1 minute'`.
* `chk_pacientes_fecha_nacimiento`: Exige `fecha_nacimiento IS NULL OR fecha_nacimiento <= CURRENT_DATE`.

### Restricciones de exclusión (EXCLUDE USING gist)

Para evitar condiciones de carrera sin bloqueos distribuidos, se utilizan índices GiST con la extensión `btree_gist`:

1. **Horarios de médico sin traslape (`horarios`):**
   ```sql
   CONSTRAINT ex_horarios_sin_traslape
     EXCLUDE USING gist (medico_id WITH =, dia_semana WITH =, timerange(hora_inicio, hora_fin) WITH &&)
     WHERE (activo);
   ```
2. **Citas de médico sin traslape (`citas`):**
   ```sql
   CONSTRAINT ex_citas_sin_traslape_medico
     EXCLUDE USING gist (medico_id WITH =, tstzrange(fecha_hora, fecha_fin) WITH &&)
     WHERE (estado_id IN (1, 2, 3));
   ```
3. **Citas de paciente sin traslape (`citas`, migración 006):**
   ```sql
   CONSTRAINT ex_citas_sin_traslape_paciente
     EXCLUDE USING gist (paciente_id WITH =, tstzrange(fecha_hora, fecha_fin) WITH &&)
     WHERE (estado_id IN (1, 2, 3));
   ```

## Disparadores (Triggers) y procedimientos almacenados

1. **Actualización de `updated_at`:** La función `set_updated_at()` se dispara `BEFORE UPDATE` en tablas maestras asignando `now()`.
2. **Cálculo de fin de cita (`calcular_fecha_fin_cita`):** Trigger `BEFORE INSERT OR UPDATE ON citas` que calcula `fecha_fin := fecha_hora + (duracion_minutos * interval '1 minute')` para habilitar el índice GiST inmutable.
3. **Auditoría inmutable (`registrar_cambio_estado_cita`):** Trigger `AFTER UPDATE ON citas` (migración 007) que lee variables de sesión (`app.cambiado_por`, `app.origen`, `app.comentario`) e inserta en `historial_estados_cita`.
4. **Blindaje de auditoría (`impedir_modificacion_historial`):** Trigger `BEFORE UPDATE OR DELETE ON historial_estados_cita` que aborta cualquier intento de alteración (RN-092).

## Vistas de conveniencia y borrado lógico

* **Vista `vw_citas_detalle`:** Centraliza las uniones entre citas, pacientes, médicos, consultorios y estados para simplificar las consultas analíticas de los dashboards.
* **Borrado Lógico (*Soft Delete*):** Las entidades `usuarios`, `pacientes`, `medicos` y `consultorios` usan `deleted_at`. La unicidad de correos y cédulas se preserva mediante índices únicos parciales:
  * `CREATE UNIQUE INDEX ux_usuarios_email_activo ON usuarios (email) WHERE deleted_at IS NULL;`
  * `CREATE UNIQUE INDEX ux_medicos_cedula_activa ON medicos (cedula_profesional) WHERE deleted_at IS NULL;`

## Uso de funciones SQL nativas en repositorios

La Tabla 17 detalla las funciones avanzadas de PostgreSQL implementadas en el código fuente para delegar el procesamiento analítico al motor.

Tabla 17. Uso de funciones SQL avanzadas en el código del repositorio.

| Función SQL utilizada | Archivo fuente en el repositorio | Líneas | Justificación técnica y resultado |
|---|---|---|---|
| `date_trunc('month', now())` | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 45-46, 112-113 | Trunca marcas de tiempo al primer día del mes para métricas mensuales. |
| `to_char(d.dia, 'YYYY-MM-DD')` / `to_char(..., 'TMDD "de" TMMonth')` | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 95-96, 118-119, 216-217 | Genera etiquetas de fecha legibles en español para gráficos Recharts. |
| `c.fecha_hora AT TIME ZONE $3` | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 236, 243, 258, 278 | Convierte marcas UTC al huso local (`America/Mexico_City`) previo a agrupar. |
| `EXTRACT(HOUR FROM ...)` | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 245, 260, 273-274 | Clasifica consultas en turnos matutinos y vespertinos. |
| `ROUND(100.0 * x / NULLIF(total, 0), 1)` | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 311, 315 | Calcula porcentajes a un decimal evitando división entre cero con `NULLIF`. |
| `TRUNC(minutos / 60.0)`, `MOD(minutos, 60)`, `CONCAT(...)` | `backend/src/infrastructure/adapters/PostgresDashboardRepository.js` | 334-338 | Convierte duración promedio a formato estructurado (ej. "1 h 30 min"). |
| `timerange(hora_inicio, hora_fin) && timerange($3, $4)` | `backend/src/infrastructure/adapters/PostgresHorarioRepository.js` | 152 | Evalúa superposición de rangos de horas directamente en la consulta SQL. |
