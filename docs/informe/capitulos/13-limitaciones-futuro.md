# Limitaciones conocidas y trabajo futuro

MediCitas cumple los requerimientos funcionales y de despliegue del Taller 3. A continuación se sintetizan sus limitaciones técnicas identificadas y las líneas de evolución propuestas.

## Limitaciones conocidas del sistema actual

1. **Captchas en memoria volátil:** La validación de captchas SVG se almacena en una estructura `Map` en RAM. Si el backend se reinicia, los captchas emitidos se pierden, y dificulta el escalamiento horizontal sin un almacén distribuido.
2. **Dependencia del túnel ngrok:** El webhook de Telegram depende del túnel gratuito de ngrok, introduciendo un punto único de falla sujeto a límites de sesión y cuotas de transferencia.
3. **Consulta directa de expedientes por médicos:** El endpoint `GET /api/pacientes/:id` responde HTTP 403 a médicos, ya que la relación clínica está mediada por las citas (`GET /api/citas/mis-pacientes`).
4. **Ausencia de pasarela de pagos:** El modelo asistencial actual asume el pago presencial en clínica; no se contemplan depósitos previos ni cobros automáticos en línea.
5. **Base de datos de nodo único:** PostgreSQL opera en una única instancia `EC2-BD` sin réplicas de lectura (*Read Replicas*) ni conmutación por error automatizada (*Multi-AZ*).

## Líneas de trabajo futuro

1. **Migración a Redis para sesiones y captchas:** Incorporar Redis para centralizar captchas efímeros y control de sesiones, permitiendo el escalamiento horizontal del backend bajo un Application Load Balancer (ALB).
2. **Dominio personalizado con TLS/SSL nativo:** Configurar un dominio en Amazon Route 53 con certificados de AWS Certificate Manager (ACM) o Let's Encrypt, prescindiendo del túnel ngrok.
3. **Módulo de Historia Clínica Electrónica (HCE):** Extender el dominio clínico para incorporar diagnósticos codificados (CIE-10/CIE-11) y emisión de recetas médicas digitales en formato PDF.
4. **Integración con WhatsApp Business API:** Extender `NotificacionPort` en n8n para admitir interacciones conversacionales mediante WhatsApp Cloud API.
5. **Arquitectura Multi-Inquilino (*Multi-Tenant*):** Parametrizar el esquema relacional mediante `tenant_id` para permitir que múltiples clínicas independientes operen sobre la misma infraestructura.
