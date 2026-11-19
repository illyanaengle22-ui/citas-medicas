# Pruebas automatizadas del sistema

La validación del comportamiento funcional y de la integridad de las reglas de negocio del sistema MediCitas se diseñó a través de una suite de pruebas de integración automatizadas basadas en scripts de shell (`bash`), herramientas estándar de red (`curl`) y procesadores de estructuras JSON (`jq`). Todos los scripts residen en el directorio `backend/tests/` y operan directamente sobre los endpoints de la API REST, simulando las peticiones reales de clientes HTTP.

## Suite de pruebas de integración

La batería de pruebas se compone de diez scripts especializados organizados por dominio funcional, orquestados mediante un script global. En la Tabla 21 se desglosa el alcance y cobertura de cada script.

Tabla 21. Batería de pruebas automatizadas del backend.

| Archivo de prueba | Casos cubiertos y validaciones de negocio |
|---|---|
| `correr-todo.sh` | Orquestador general. Ejecuta secuencialmente todos los scripts de prueba `probar-*.sh`, recopila los conteos de pruebas aprobadas y fallidas, y genera un reporte consolidado con código de salida estandarizado. |
| `probar-usuarios.sh` | Creación de usuarios con roles válidos, bloqueo de inicio de sesión en cuentas pendientes, aprobación de cuentas por el administrador, rechazo de solicitudes, restricciones de asignación de rol médico por vía genérica y borrado lógico. |
| `probar-especialidades.sh`| Alta de especialidades médicas, control de unicidad de nombre (RN-030), modificación de descripción, activación e inactivación lógica (RN-031) y filtrado de especialidades disponibles. |
| `probar-consultorios.sh` | CRUD de sedes físicas, validación de campos obligatorios (nombre y dirección), borrado lógico (RN-033) y rechazo con código HTTP 409 ante intentos de eliminación de consultorios con citas vigentes. |
| `probar-medicos.sh` | Registro transaccional atómico de médico con usuario y relaciones (RN-042), unicidad de cédula profesional (RN-041), reemplazo completo de especialidades y consultorios, ocultamiento de datos confidenciales ante pacientes (RN-046) y baja lógica en cascada (RN-045). |
| `probar-pacientes.sh` | Creación de ficha de paciente, validación de aislamiento de datos privados (un paciente solo puede consultar su propio registro, retornando 403 ante accesos no autorizados segun RN-053) y baja lógica de cuenta. |
| `probar-integracion.sh` | Flujo integral de punta a punta: cálculo de huecos libres, agendamiento de cita en estado pendiente, confirmación de cita, intento de doble agendamiento en el mismo horario (validación del error 409 por restricción `EXCLUDE USING gist`) y transiciones de estado permitidas. |
| `probar-reagendar.sh` | Consulta algorítmica de los 3 huecos libres más cercanos para una cita vigente (RN-083), validación de anticipación mínima (RN-086), ejecución del reagendamiento con revalidación de traslapes (RN-084) y verificación de auditoría inmutable. |
| `probar-telegram.sh` | Generación de código efímero de vinculación de 6 caracteres con 15 minutos de TTL (RN-116), canje autenticado con `x-webhook-secret`, verificación de idempotencia, emisión de tokens JWT para el bot y procesamiento de respuestas de recordatorios. |
| `probar-dashboard.sh` | Consulta y consistencia de los resúmenes analíticos para administrador, médico y paciente; verificación de ausencia total de fugas de contraseñas (`password_hash`), validación de filtros de rangos de fechas y cálculo de porcentajes sin divisiones por cero. |
