# Introducción y objetivos

El presente informe técnico documenta el diseño, desarrollo, implementación y despliegue del sistema web de gestión de citas médicas denominado **MediCitas**. Este proyecto fue desarrollado en el marco del Taller 3, "Desarrollo web con Arquitectura Hexagonal desplegado en AWS", con el propósito de aplicar patrones de arquitectura de software desacoplados, buenas prácticas de desarrollo backend y frontend, mecanismos robustos de integridad en bases de datos relacionales, e integración de flujos automatizados de mensajería asíncrona mediante agentes inteligentes desplegados en una infraestructura en la nube.

La gestión tradicional de citas médicas en clínicas y centros de salud suele enfrentar diversas problemáticas operativas, tales como la duplicidad de reservas en un mismo horario, la falta de confirmación oportuna por parte de los pacientes, el ausentismo no notificado y la dificultad para reprogramar consultas de forma ágil. Para abordar estos desafíos, se concibió MediCitas como una solución integral que desacopla la lógica de negocio de los detalles de infraestructura, garantizando la consistencia transaccional y facilitando la interacción omnicanal mediante la plataforma web y la aplicación de mensajería Telegram.

## Objetivos del proyecto

### Objetivo general

Diseñar, implementar y desplegar en Amazon Web Services (AWS) una plataforma web para la administración y agendamiento de citas médicas basada en principios de Arquitectura Hexagonal (Puertos y Adaptadores), complementada con un motor de automatización de flujos de trabajo (n8n) conectado a Telegram, asegurando alta disponibilidad, integridad referencial y separación estricta de responsabilidades.

### Objetivos específicos

1. Implementar la lógica del negocio clínico bajo el patrón de **Arquitectura Hexagonal**, organizando el sistema en capas independientes de Dominio, Aplicación, Infraestructura e Interfaces, permitiendo que las entidades y casos de uso permanezcan aislados de motores de bases de datos o marcos web concretos.
2. Modelar una base de datos relacional sobre **PostgreSQL 14+** que garantice la integridad de los datos mediante restricciones avanzadas a nivel de motor, incluyendo exclusiones de traslape temporal (`EXCLUDE USING gist`), borrado lógico generalizado y auditoría histórica inmutable por medio de disparadores (*triggers*).
3. Desarrollar una interfaz de usuario interactiva y responsiva utilizando **React 19** y **Vite**, que provea tableros diferenciados para los roles de administrador, médico y paciente, así como calendarios interactivos y flujos guiados para la reserva de citas.
4. Integrar un subsistema de automatización mediante **n8n** y modelos de lenguaje de inteligencia artificial, habilitando un bot conversacional en Telegram capaz de autenticar pacientes, agendar consultas, enviar recordatorios preventivos y procesar confirmaciones o cancelaciones de forma síncrona y asíncrona.
5. Diseñar y ejecutar una arquitectura de despliegue en la nube de **Amazon Web Services (AWS)** distribuida en cuatro instancias dedicadas de Amazon EC2, configurando grupos de seguridad (*Security Groups*), servidores web Nginx en configuración de proxy inverso, administradores de procesos en segundo plano con PM2 y contenedores Docker para los servicios de automatización.
6. Validar la funcionalidad global de la plataforma a través de una batería de pruebas de integración automatizadas sobre la interfaz de programación de aplicaciones (API REST).
