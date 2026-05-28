# PRD F-04 — Workout logging detallado (WorkoutSet)

| Campo | Valor |
|---|---|
| **Feature ID** | F-04 |
| **Sprint** | Sprint 2 |
| **Prioridad** | Alta (bloqueador MVP — la diferencia entre "agenda" y "app de gym") |
| **Tareas Fibery** | #56, #57, #58 |
| **Documento RFC** | [`../rfcs/RF-04-workout-set-logging.md`](../rfcs/RF-04-workout-set-logging.md) |

## 1. TL;DR

Hoy `ActivityLog` solo guarda `duration` y `calories` totales — no se sabe qué peso, qué reps ni qué ejercicios hizo el usuario. Esta feature introduce el modelo `WorkoutSet` para registrar cada serie de cada ejercicio durante un entrenamiento, y refactoriza `POST /progress/log` para aceptar esa información. Es lo que convierte a G-Pulse en una app de gym de verdad.

## 2. Contexto y problema

- Una app de gym vive de los datos: peso levantado, reps logradas, tiempo bajo tensión, RPE. Sin ese detalle:
  - No hay records personales (F-05).
  - No hay sugerencia de progresión de carga.
  - El histórico es solo "entrené 45 min hoy" — inútil para análisis.
- Modelo actual:
  - `ActivityLog { duration, calories, date, routineId }` — agregado.
  - `RoutineExercise { sets, reps, duration }` — define lo planeado, no lo ejecutado.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Capturar cada set ejecutado | % de logs con ≥ 1 `WorkoutSet` (en clientes nuevos) | ≥ 95% |
| Histórico por ejercicio | Endpoint `GET /progress/exercise/:id` retorna sets ordenados | Sí |
| Backward compatibility | Logs antiguos sin sets siguen consultables | Sí |
| Performance | p95 para `POST /progress/log` con 30 sets | < 400 ms |

## 4. Alcance

### In scope
- Nuevo modelo Prisma `WorkoutSet` con migración.
- Refactor de `POST /progress/log` para aceptar opcionalmente un array `sets[]`.
- Cálculo automático de `duration` y `calories` si no se envían pero hay sets (opcional — ver RFC).
- `GET /progress/exercise/:exerciseId` para ver progresión personal.
- Mantener compatibilidad con clientes que solo envíen `duration` + `calories`.

### Out of scope
- Sugerencias automáticas de carga (post-MVP).
- Cronómetro de descanso entre series (esto vive en el cliente).
- Cálculo de 1RM estimado → cubierto por F-05.

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado que termina un entrenamiento.
- **Casos**:
  1. "Acabo de hacer mi rutina de pecho, registro lo que hice por ejercicio" → `POST /progress/log` con `sets`.
  2. "Quiero ver cómo viene mi bench press en los últimos meses" → `GET /progress/exercise/:id`.
  3. "Quiero registrar solo que entrené 30 min de cardio sin desglose" → `POST /progress/log` con solo `duration` + `calories`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | `WorkoutSet` debe poder asociarse a un `ActivityLog`, a un `Exercise` y opcionalmente a un `RoutineExercise`. |
| RF-02 | Campos por set: `setNumber`, `weightKg?`, `reps?`, `durationSec?`, `rpe?` (1-10), `completed` (bool), `notes?`. |
| RF-03 | `POST /progress/log` acepta `sets: WorkoutSetDto[]` opcional. |
| RF-04 | Si se envían `sets` pero no `duration`, **no falla** — `duration` puede ser 0 o calculado. (Definir en RFC.) |
| RF-05 | Si se envían `sets` pero no `calories`, no falla — `calories` se calcula o queda 0. |
| RF-06 | `GET /progress/exercise/:exerciseId` retorna todos los sets del usuario en ese ejercicio, ordenados por fecha desc. |
| RF-07 | Sets del usuario A no son visibles para el usuario B (autorización por dueño del `ActivityLog`). |
| RF-08 | Borrar un `ActivityLog` debe borrar en cascada sus `WorkoutSet`. |

## 7. Requisitos no funcionales

- **Backward compatibility**: clientes que envíen solo `{ duration, calories }` deben seguir funcionando.
- **Performance**: insertar 30 sets debe completarse en < 400 ms p95.
- **Auditabilidad**: cada set tiene `createdAt` y `updatedAt`.

## 8. Criterios de aceptación

- [ ] Migración `add_workout_set` aplicada en staging y dev.
- [ ] `POST /progress/log` sin `sets` sigue funcionando (legacy).
- [ ] `POST /progress/log` con `sets` crea el log + N sets en transacción.
- [ ] `GET /progress/exercise/:id` retorna sets paginados con `date`, `weightKg`, `reps`, etc.
- [ ] `GET /progress/exercise/:id` solo del usuario logueado.
- [ ] Test unitario: borrar `ActivityLog` borra cascada de sets.
- [ ] Performance test: 30 sets insertados < 400 ms.

## 9. Dependencias y riesgos

- **Dependencia**: F-02 (CRUD rutinas) deseable pero no bloqueante — se puede registrar progreso sin que la rutina exista.
- **Bloqueante de**: F-05 (PRs) que se calculan sobre `WorkoutSet`.
- **Riesgo**: cliente móvil necesita refactor para enviar sets. **Mitigación**: aceptar el formato legacy durante la transición.
- **Riesgo**: explosión de datos (un usuario activo podría generar 50-100 sets/semana = ~5K/año). **Mitigación**: no es problema a esta escala; agregar índice `userId + exerciseId + date`.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §2.3 (modelo `WorkoutSet`)
- Tareas: Fibery #56, #57, #58
- Archivos afectados:
  - `prisma/schema.prisma` (nuevo modelo + migración)
  - `src/progress/progress.controller.ts`
  - `src/progress/progress.service.ts`
  - `src/progress/dto/log-activity.dto.ts`
  - `src/progress/dto/workout-set.dto.ts` (nuevo)
