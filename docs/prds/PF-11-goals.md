# PRD F-11 — Goals / Objetivos

| Campo | Valor |
|---|---|
| **Feature ID** | F-11 |
| **Sprint** | MVP (priorización flex) |
| **Prioridad** | Media |
| **Tareas Fibery** | #66 |
| **Documento RFC** | [`../rfcs/RF-11-goals.md`](../rfcs/RF-11-goals.md) |

## 1. TL;DR

Permitir al usuario fijar objetivos medibles ("entrenar 4 veces por semana", "perder 3 kg en 2 meses", "subir 10 kg en bench press") y consultar su progreso. Es el feature que conecta entrenamientos + mediciones + PRs con una intención clara del usuario.

## 2. Contexto y problema

- Sin objetivos, los datos son curiosidad pasiva.
- Con objetivos, cada workout/medición/PR tiene un propósito.
- Compatible con sistemas de gamificación futuros.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Permitir tracking de objetivos | Modelo + CRUD | Sí |
| % usuarios con ≥ 1 goal activo a las 2 semanas | DAU activos con goal | ≥ 25% |
| % objetivos cumplidos en plazo | KPI de motivación | ≥ 35% |

## 4. Alcance

### In scope
- Modelo `Goal` con `type` (enum), `target`, `unit`, `deadline?`, `status`.
- Tipos soportados en v1:
  - `WORKOUTS_PER_WEEK` (cuántos entrenamientos por semana)
  - `WEIGHT_LOSS_KG` (perder X kg desde el inicio)
  - `WEIGHT_GAIN_KG` (ganar X kg)
  - `EXERCISE_PR_KG` (subir el 1RM de un ejercicio específico a X kg)
- CRUD: `POST`, `GET (list)`, `GET (id)`, `PATCH`, `DELETE`.
- Endpoint `GET /goals/me/progress` que calcula el avance actual de cada goal activo.

### Out of scope
- Goals colaborativos.
- Goals tipo "racha de N días" (cubierto implícitamente por `User.trainingStreak`, no necesita un goal explícito).
- Notificación al cumplir (queda para F-10).

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado.
- **Casos**:
  1. "Quiero entrenar 4 veces por semana este mes" → `POST /goals` con `WORKOUTS_PER_WEEK`, target=4.
  2. "Quiero subir mi 1RM de banca de 100 a 120 kg para Diciembre" → `POST /goals` con `EXERCISE_PR_KG`, target=120, exerciseId, deadline.
  3. "¿Cómo voy con mis objetivos?" → `GET /goals/me/progress`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | Validar `type`, `target` numérico, `unit` derivado del type. |
| RF-02 | `EXERCISE_PR_KG` requiere `exerciseId`. |
| RF-03 | `WEIGHT_LOSS_KG` y `WEIGHT_GAIN_KG` requieren `baselineKg` (peso inicial) — capturar del último `BodyMeasurement` si no se envía. |
| RF-04 | Estado inicial: `ACTIVE`. Otros: `COMPLETED`, `CANCELED`, `EXPIRED`. |
| RF-05 | `GET /goals/me/progress` calcula avance porcentual usando datos reales (logs / sets / measurements). |
| RF-06 | Goal expirado (deadline < now) sin cumplir → estado `EXPIRED`. |
| RF-07 | Goal cumplido → estado `COMPLETED` con timestamp. (Puede actualizarse en demand o por job.) |

## 7. Requisitos no funcionales

- **Auth**: JWT obligatorio.
- **Validación**: rangos saneados por `type`.
- **Performance**: cálculo de progreso < 300 ms p95.

## 8. Criterios de aceptación

- [ ] `POST /goals` con `EXERCISE_PR_KG` sin `exerciseId` → 400.
- [ ] `GET /goals/me/progress` para `WORKOUTS_PER_WEEK` cuenta `ActivityLog` de la semana actual.
- [ ] `GET /goals/me/progress` para `WEIGHT_LOSS_KG` calcula `baseline - latestWeight`.
- [ ] Goal con deadline pasado y target no cumplido → `EXPIRED`.

## 9. Dependencias y riesgos

- **Dependencia**: F-05 (PRs) para `EXERCISE_PR_KG`.
- **Dependencia**: F-09 (mediciones) para goals de peso.
- **Riesgo**: complejidad si se permiten muchos tipos. Empezar con 4 y crecer iterativamente.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §3.4
- Tareas: Fibery #66
- Archivos afectados:
  - `prisma/schema.prisma` (nuevo modelo + enum)
  - `src/goals/` (módulo nuevo)
