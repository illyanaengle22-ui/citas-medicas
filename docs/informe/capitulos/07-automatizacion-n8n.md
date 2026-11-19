# Automatización con n8n y asistente conversacional

MediCitas integra un subsistema de automatización basado en **n8n (v2.43.7)** que conecta el backend con **Telegram**, ofreciendo un agente conversacional interactivo con modelos de lenguaje y el despacho automatizado de recordatorios preventivos.

La Figura 4 detalla la secuencia entre el planificador de recordatorios, n8n, Telegram y el paciente.

![Figura 4. Diagrama de secuencia del subsistema de recordatorios y atención por Telegram.](img/secuencia-recordatorio-telegram.png)

## Arquitectura del flujo de trabajo (`MediCitas.json`)

El flujo reside en `MediCitas.json` (ID: `GLIxoBsZqn5Tb9bT`) y consta de **31 nodos interconectados**.

### 1. Disparadores (*Triggers*)

* **Telegram Trigger (`Entrada`):** Recibe mensajes y comandos dirigidos a `@medicitasAppBot` vía el túnel HTTPS de ngrok.
* **Webhook (`Webhook`):** Expone `/webhook/recordatorios` en el puerto 5678, consumido internamente por el scheduler de backend.

### 2. Vinculación y autenticación de pacientes

1. **Filtro (`Solo texto`):** Descarta mensajes binarios no procesables.
2. **Evaluación de sesión (`Obtener token`):** Invoca `POST /api/telegram/sesion` con el `chatId`. Si la cuenta está enlazada y activa, emite un JWT válido por 24 horas.
3. **Bifurcación (`Codigo sin vincular?`):** Si el mensaje contiene `/start <CODIGO>` (código de 6 caracteres generado en la webapp, RN-116), el nodo `Vincular cuenta` ejecuta `POST /api/telegram/vincular` con `x-webhook-secret` y confirma el enlace al paciente.

### 3. Agente de IA y herramientas HTTP

El nodo **AI Agent** opera como un agente conversacional con memoria temporal (`Simple Memory`) respaldado por **Groq Chat Model** (Llama 3 / Mixtral) y **Google Gemini Chat Model**. Dispone de **13 herramientas HTTP** conectadas a la API REST, detalladas en la Tabla 18.

Tabla 18. Herramientas HTTP expuestas al agente conversacional en n8n.

| Nombre de la herramienta | Endpoint backend asociado | Método HTTP | Acción ejecutada |
|---|---|:---:|---|
| `list_specialties` | `/api/especialidades` | GET | Consulta de disciplinas médicas activas. |
| `search_doctors` | `/api/medicos` | GET | Búsqueda de facultativos y sus sedes. |
| `get_available_slots`| `/api/horarios/medico/:id` | GET | Cálculo dinámico de huecos libres por fecha. |
| `list_my_appointments` | `/api/citas` | GET | Listado de citas del paciente autenticado. |
| `get_appointment` | `/api/citas/:id` | GET | Detalle específico de una consulta. |
| `get_appointment_history` | `/api/citas/:id/historial` | GET | Auditoría de estados de la cita (RN-090). |
| `create_appointment` | `/api/citas` | POST | Reserva de cita (creada como `confirmada`). |
| `confirm_appointment`| `/api/citas/:id/confirmar` | PUT | Confirmación explícita de asistencia. |
| `cancel_appointment` | `/api/citas/:id` | DELETE | Cancelación y liberación de horario (RN-085). |
| `get_reschedule_options` | `/api/citas/:id/propuestas` | GET | Propuesta de 3 huecos más cercanos (RN-083). |
| `reschedule_appointment` | `/api/citas/:id` | PUT | Reprogramación efectiva de cita (RN-084). |

## Ciclo de vida de los recordatorios

1. **Detección programada:** Cada 5 minutos, `recordatorioScheduler.js` busca citas vigentes en ventanas de 24h (RN-100) y 2h (RN-101) con Telegram enlazado.
2. **Despacho a n8n:** El adaptador `N8nNotificacionAdapter` envía la carga JSON al webhook de n8n.
3. **Envío con botones interactivos:** El nodo `Send a text message` transmite a Telegram los datos de la cita y botones en línea: "Confirmar", "Cancelar" y "Reagendar".
4. **Respuesta del paciente:** Al presionar un botón, n8n transmite la acción a `POST /api/webhooks/n8n/respuesta`. El caso de uso `ProcesarRespuestaTelegram` actualiza la cita, registra auditoría inmutable e instruye la confirmación al chat.
