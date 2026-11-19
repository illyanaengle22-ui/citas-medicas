# Arquitectura hexagonal

MediCitas adopta el patrón de **Arquitectura Hexagonal** (Puertos y Adaptadores) de Alistair Cockburn, situando las entidades del dominio y los casos de uso en el centro del sistema, aislándolos de frameworks web, protocolos HTTP y motores de persistencia.

## Justificación de la arquitectura seleccionada

1. **Independencia tecnológica:** La lógica clínica (reglas de agendamiento, transiciones y disponibilidad) reside en el dominio y aplicación; Express y PostgreSQL actúan como detalles de infraestructura intercambiables.
2. **Capacidad de prueba (*Testability*):** Al desacoplar la persistencia mediante interfaces abstractas (puertos), los casos de uso pueden evaluarse con dobles de prueba sin bases de datos activas.
3. **Omnicanalidad:** Tanto la aplicación web React como el bot conversacional de Telegram (vía n8n) consumen los mismos casos de uso sin duplicar validaciones.
4. **Mantenibilidad:** Cambios en esquemas o librerías quedan confinados a sus adaptadores, sin propagarse hacia el núcleo del negocio.

La Figura 1 muestra la organización concéntrica de las cuatro capas de MediCitas.

![Figura 1. Diagrama de Arquitectura Hexagonal del sistema MediCitas.](img/arquitectura-hexagonal.png)

## Estructura de capas y organización del código

### 1. Capa de Dominio (`src/domain/`)

Núcleo del sistema sin dependencias externas:
* **Entidades (`src/domain/entities/`):** `Cita.js` (invariantes de duración y estados), `Horario.js`, `Medico.js`, `Usuario.js` y `Recordatorio.js`.
* **Puertos (`src/domain/ports/`):** Interfaces que declaran contratos de persistencia y comunicación: `CitaRepositoryPort.js`, `HorarioRepositoryPort.js`, `MedicoRepositoryPort.js`, `RecordatorioRepositoryPort.js` y `NotificacionPort.js`.

### 2. Capa de Aplicación (`src/application/`)

Orquesta los flujos de interacción a través de casos de uso (`src/application/use-cases/`):
* `AgendarCita.js`, `ConfirmarCita.js`, `CancelarCita.js`, `ReagendarCita.js`.
* `EnviarRecordatorio.js` y `ProcesarRespuestaTelegram.js`.
* `AprobarUsuario.js`, `RechazarUsuario.js`, `ObtenerResumenAdmin.js`, `ObtenerResumenMedico.js` y `ObtenerResumenPaciente.js`.

### 3. Capa de Infraestructura (`src/infrastructure/`)

Implementa tecnológicamente los puertos declarados en el dominio:
* **Adaptadores de persistencia:** `PostgresCitaRepository.js`, `PostgresHorarioRepository.js`, `PostgresMedicoRepository.js` y `PostgresRecordatorioRepository.js`.
* **Adaptador de notificación:** `N8nNotificacionAdapter.js` (despacha peticiones HTTP hacia n8n).
* **Jobs en segundo plano:** `recordatorioScheduler.js` (evalúa ventanas de 24h y 2h) y `citasVencidasScheduler.js`.

### 4. Capa de Interfaces (`src/interfaces/`)

Puntos de contacto externos vía API REST Express:
* **Rutas y controladores:** Enrutadores en `src/interfaces/http/routes/` y controladores en `src/interfaces/http/controllers/` (`CitaController.js`, `AuthController.js`, etc.).
* **Middlewares:** `autenticarJWT.js` (firma y vigencia de token), `requerirRol.js` (RBAC) y `resolverActor.js` (inyección de contexto en transacciones de auditoría).

## Flujo integral de una petición: "Agendar Cita Médica"

La Figura 2 ilustra el ciclo completo de una solicitud de reserva desde el cliente web hasta su persistencia en PostgreSQL.

![Figura 2. Diagrama de secuencia del flujo integral para agendar una cita médica.](img/secuencia-agendar-cita.png)

1. **Petición HTTP:** El paciente envía `POST /api/citas` desde React hacia Nginx con su token JWT.
2. **Intermediación y seguridad:** Nginx reenvía al backend (puerto 4000); los middlewares `autenticarJWT` y `resolverActor` validan la identidad del paciente.
3. **Controlador y Caso de Uso:** `CitaController` delega a `AgendarCita.js`, el cual verifica que la duración esté entre 10 y 240 min (RN-071), que la fecha sea futura (RN-073) y consulta a `HorarioRepositoryPort` para asegurar que el bloque esté activo (RN-072).
4. **Persistencia e integridad:** `PostgresCitaRepository` abre una transacción e inserta en `citas`. El trigger `trg_citas_fecha_fin` calcula el término de la cita y el motor evalúa las restricciones GiST (`ex_citas_sin_traslape_medico` y `ex_citas_sin_traslape_paciente`).
5. **Respuesta:** Si hay colisión concurrente (error 23P01), se responde HTTP 409 ("El horario ya fue ocupado"). Si es exitosa, se responde HTTP 201 Created con el DTO consolidado.
