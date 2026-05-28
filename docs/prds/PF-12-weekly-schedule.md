# PRD F-12 — Calendario semanal de rutinas

| Campo | Valor |
|---|---|
| **Feature ID** | F-12 |
| **Sprint** | MVP (priorización flex) |
| **Prioridad** | Media |
| **Tareas Fibery** | #67 |
| **Documento RFC** | [`../rfcs/RF-12-weekly-schedule.md`](../rfcs/RF-12-weekly-schedule.md) |

## 1. TL;DR

Permitir asignar rutinas a días específicos de la semana (Lun: Push, Mar: Pull, etc.) y exponer `GET /routines/today` que devuelve la rutina del día.

## 2. Contexto y problema

- Hoy las rutinas son "una bolsa": no hay forma de saber qué tocaba entrenar hoy.
- La mayoría de apps de gym tienen un calendario semanal o un "split routine".

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Asignar rutinas a días | Modelo + endpoints | Sí |
| Mostrar "rutina de hoy" en home | `GET /routines/today` | Sí |
| Adopción | % de usuarios con ≥ 1 día asignado | ≥ 40% |

## 4. Alcance

### In scope
- Nuevo modelo `RoutineSchedule { userId, routineId, dayOfWeek (0-6), enabled }`.
- `POST /schedule` — asignar rutina a un día (upsert por `(userId, dayOfWeek)`).
- `DELETE /schedule/:dayOfWeek` — quitar.
- `GET /schedule` — listar el calendario completo del usuario.
- `GET /routines/today` — atajo: retorna la rutina asignada a hoy.

### Out of scope
- Calendarios complejos (microciclos de 2 semanas, etc.).
- Notificaciones de "hoy te toca entrenar" (depende de F-10 y un cron).

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado.
- **Casos**:
  1. "Quiero entrenar Pecho lunes y miércoles, Pierna martes y jueves" → 4 `POST /schedule`.
  2. "¿Qué tengo que entrenar hoy?" → `GET /routines/today`.
  3. "Cancelé el martes" → `DELETE /schedule/2`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | `dayOfWeek` válido: 0 (domingo) a 6 (sábado), siguiendo `Date.getDay()`. |
| RF-02 | Una rutina puede ocupar varios días; un día solo una rutina. |
| RF-03 | `POST /schedule` upsert por `(userId, dayOfWeek)`. |
| RF-04 | `GET /routines/today` retorna `null` si el día no tiene asignación. |
| RF-05 | Borrar la rutina (F-02 DELETE) borra los schedule entries en cascada. |
| RF-06 | Asignar una rutina pública ajena debe estar permitido (uso del feed). |

## 7. Requisitos no funcionales

- **Auth**: JWT obligatorio.
- **Performance**: trivial.

## 8. Criterios de aceptación

- [ ] `POST /schedule` 2 veces con mismo `dayOfWeek` → reemplaza.
- [ ] `GET /routines/today` para usuario sin schedule → 200 con `null` o vacío.
- [ ] `GET /schedule` retorna array de 7 entradas con la rutina (o null) por día.
- [ ] `DELETE Routine` borra schedule entries asociados.

## 9. Dependencias y riesgos

- **Dependencia**: F-02 (CRUD rutinas).
- **Riesgo**: usuarios con calendario fijo por mucho tiempo no quieren "modificar todas las semanas". Diseño actual es estático, lo cual es deseable para MVP.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §3.5
- Tareas: Fibery #67
- Archivos afectados:
  - `prisma/schema.prisma` (nuevo modelo)
  - `src/schedule/` (módulo nuevo)
  - `src/routines/routines.controller.ts` (`GET today`)
