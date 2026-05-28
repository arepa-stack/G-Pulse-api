# PRD F-07 — Likes en rutinas

| Campo | Valor |
|---|---|
| **Feature ID** | F-07 |
| **Sprint** | Sprint 3 |
| **Prioridad** | Media |
| **Tareas Fibery** | #61 |
| **Documento RFC** | [`../rfcs/RF-07-likes.md`](../rfcs/RF-07-likes.md) |

## 1. TL;DR

Permitir a los usuarios dar y quitar "like" a rutinas públicas. El campo `Routine.likes` ya existe pero no hay endpoint que lo modifique. Esta feature habilita el ranking del feed (F-03 con `?sort=likes`).

## 2. Contexto y problema

- El feed público (F-03) ya soporta `?sort=likes`, pero el contador nunca crece.
- Sin "like" no hay señal social ni mecanismo de descubrimiento de calidad.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Habilitar señal de calidad social | 2 endpoints + 1 modelo | Sí |
| Likes únicos por usuario | Garantía vía PK compuesta | Sí |
| Performance | p95 del toggle | < 100 ms |

## 4. Alcance

### In scope
- Nuevo modelo `RoutineLike(userId, routineId)`.
- `POST /routines/:id/like` — like (idempotente).
- `DELETE /routines/:id/like` — unlike (idempotente).
- Mantener `Routine.likes` actualizado vía transacción.
- Solo se puede dar like a rutinas públicas.

### Out of scope
- Likes en ejercicios.
- Likes en comentarios (no hay comentarios todavía).

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado.
- **Casos**:
  1. "Esta rutina pública está buena, le doy like" → `POST /routines/:id/like`.
  2. "Quité el like porque ya no la sigo" → `DELETE /routines/:id/like`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | Solo se puede dar like a rutinas con `isPublic=true`. |
| RF-02 | Un usuario puede dar like a su propia rutina pública (decisión de producto, default sí). |
| RF-03 | Doble `POST` no incrementa el contador 2 veces (idempotente). |
| RF-04 | Doble `DELETE` no decrementa por debajo de 0. |
| RF-05 | `Routine.likes` debe coincidir siempre con `count(RoutineLike where routineId)`. |
| RF-06 | Eliminar la rutina debe borrar sus likes en cascada. |

## 7. Requisitos no funcionales

- **Auth**: JWT obligatorio.
- **Consistencia**: contador y tabla siempre coherentes vía transacción.
- **Performance**: < 100 ms p95.

## 8. Criterios de aceptación

- [ ] `POST /routines/:id/like` sobre rutina privada → 403.
- [ ] `POST` idempotente: 2 llamadas, `Routine.likes` sube 1 vez.
- [ ] `DELETE` idempotente.
- [ ] Después de un `DELETE Routine`, no quedan `RoutineLike` huérfanos.
- [ ] `GET /routines/public?sort=likes` ordena correctamente.

## 9. Dependencias y riesgos

- **Dependencia**: F-03 (feed) deseable.
- **Riesgo**: race condition entre contador y filas. **Mitigación**: usar `prisma.$transaction` y `prisma.routine.update` con `increment` atómico.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §4.2
- Tareas: Fibery #61
- Archivos afectados:
  - `prisma/schema.prisma` (nuevo modelo `RoutineLike`)
  - `src/routines/routines.controller.ts`
  - `src/routines/routines.service.ts`
