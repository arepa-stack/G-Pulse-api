# G-Pulse Backend — Índice de documentación

Documentación del backend de G-Pulse, organizada por tipo y por feature.

---

## Documentos generales

| Documento | Propósito |
|---|---|
| [`PROJECT_MAP.md`](./PROJECT_MAP.md) | Mapa detallado del proyecto: módulos, endpoints, modelo de datos. |
| [`MVP_GAP_ANALYSIS.md`](./MVP_GAP_ANALYSIS.md) | Análisis de gaps para llegar al MVP y roadmap por sprints. |
| [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) | Referencia exhaustiva de la API (existente). |

---

## Features y documentación técnica

Cada feature tiene un **PRD** (qué construir y por qué) y un **RFC** (cómo construirlo).

| Feature ID | Nombre | Sprint | PRD | RFC | Tareas Fibery |
|---|---|---|---|---|---|
| F-01 | Seguridad: AuthGuard en endpoints expuestos | S1 | [PRD](./prds/PF-01-auth-guard-fix.md) | [RFC](./rfcs/RF-01-auth-guard-fix.md) | #49, #50 |
| F-02 | Gestión de rutinas del usuario (CRUD) | S1 | [PRD](./prds/PF-02-routines-crud.md) | [RFC](./rfcs/RF-02-routines-crud.md) | #51, #52, #53, #54 |
| F-03 | Feed público de rutinas | S1 | [PRD](./prds/PF-03-public-routines-feed.md) | [RFC](./rfcs/RF-03-public-routines-feed.md) | #55 |
| F-04 | Workout logging detallado (WorkoutSet) | S2 | [PRD](./prds/PF-04-workout-set-logging.md) | [RFC](./rfcs/RF-04-workout-set-logging.md) | #56, #57, #58 |
| F-05 | Records personales (PRs) | S2 | [PRD](./prds/PF-05-personal-records.md) | [RFC](./rfcs/RF-05-personal-records.md) | #59 |
| F-06 | Favoritos | S3 | [PRD](./prds/PF-06-favorites.md) | [RFC](./rfcs/RF-06-favorites.md) | #60 |
| F-07 | Likes en rutinas | S3 | [PRD](./prds/PF-07-likes.md) | [RFC](./rfcs/RF-07-likes.md) | #61 |
| F-08 | Gestión de suscripción (estado / cancelación) | S3 | [PRD](./prds/PF-08-subscription-management.md) | [RFC](./rfcs/RF-08-subscription-management.md) | #62, #71 |
| F-09 | Mediciones corporales | S4 | [PRD](./prds/PF-09-body-measurements.md) | [RFC](./rfcs/RF-09-body-measurements.md) | #63 |
| F-10 | Notificaciones push (FCM) | S4 | [PRD](./prds/PF-10-push-notifications.md) | [RFC](./rfcs/RF-10-push-notifications.md) | #65 |
| F-11 | Goals / Objetivos | MVP+ | [PRD](./prds/PF-11-goals.md) | [RFC](./rfcs/RF-11-goals.md) | #66 |
| F-12 | Calendario semanal de rutinas | MVP+ | [PRD](./prds/PF-12-weekly-schedule.md) | [RFC](./rfcs/RF-12-weekly-schedule.md) | #67 |
| F-13 | Upload de imágenes propias | MVP+ | [PRD](./prds/PF-13-image-upload.md) | [RFC](./rfcs/RF-13-image-upload.md) | #68 |
| F-14 | Catálogo extendido (admin: músculos / categorías) | Post-S4 | [PRD](./prds/PF-14-admin-catalog-extended.md) | [RFC](./rfcs/RF-14-admin-catalog-extended.md) | #69, #70 |
| F-15 | Hardening admin (DTO para `PATCH /admin/users/:id`) | S4 | [PRD](./prds/PF-15-admin-hardening.md) | [RFC](./rfcs/RF-15-admin-hardening.md) | #64 |

> **Post-MVP** (#72-#75: social, nutrición, wearables, marketplace) no tienen PRD/RFC aún. Se documentarán cuando se priorizen.

---

## Convenciones

### PRD — Product Requirements Document

Estructura estándar:
1. Resumen / TL;DR
2. Contexto y problema
3. Objetivo y métricas de éxito
4. Alcance (in scope / out of scope)
5. Usuarios y casos de uso
6. Requisitos funcionales
7. Requisitos no funcionales
8. Criterios de aceptación
9. Dependencias y riesgos
10. Referencias

### RFC — Request for Comments (diseño técnico)

Estructura estándar:
1. Resumen / TL;DR
2. Contexto técnico
3. Diseño propuesto (API, esquema BD, código)
4. Alternativas consideradas
5. Migraciones / compatibilidad
6. Seguridad, performance, testing
7. Plan de rollout
8. Open questions
