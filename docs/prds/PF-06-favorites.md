# PRD F-06 — Favoritos

| Campo | Valor |
|---|---|
| **Feature ID** | F-06 |
| **Sprint** | Sprint 3 |
| **Prioridad** | Media |
| **Tareas Fibery** | #60 |
| **Documento RFC** | [`../rfcs/RF-06-favorites.md`](../rfcs/RF-06-favorites.md) |

## 1. TL;DR

Permitir a un usuario marcar rutinas (propias o públicas) como favoritas para acceso rápido. El modelo `UserFavorite` ya existe en Prisma — solo faltan los 3 endpoints.

## 2. Contexto y problema

- El modelo `UserFavorite { userId, routineId }` con PK compuesta ya existe en el schema.
- Cuando llegue el feed público (F-03), el usuario querrá guardar rutinas que le interesan sin clonarlas.
- Para rutinas propias, el favorito sirve como "anclar arriba" la rutina activa.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Habilitar bookmarking | 3 endpoints operativos | 3/3 |
| Engagement | Usuarios que han marcado ≥ 1 favorito (semana 4) | ≥ 30% |

## 4. Alcance

### In scope
- `POST /routines/:id/favorite` — marcar.
- `DELETE /routines/:id/favorite` — desmarcar.
- `GET /users/me/favorites` — listar rutinas favoritas del usuario.

### Out of scope
- Favoritos sobre ejercicios individuales (post-MVP).
- Listas de favoritos múltiples / carpetas (post-MVP).
- Compartir lista de favoritos.

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado.
- **Casos**:
  1. "Vi una rutina pública que me gusta, la quiero guardar" → `POST /routines/:id/favorite`.
  2. "Quiero ver mi colección de rutinas favoritas" → `GET /users/me/favorites`.
  3. "Esa rutina ya no me sirve, la saco de favoritos" → `DELETE /routines/:id/favorite`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | `POST /routines/:id/favorite` es idempotente: si ya es favorito → 204 sin error. |
| RF-02 | `DELETE /routines/:id/favorite` también idempotente. |
| RF-03 | Solo se pueden favoritar rutinas accesibles (propias o `isPublic=true`). |
| RF-04 | `GET /users/me/favorites` retorna paginado, con datos básicos de cada rutina (`name`, `creator.name`, `_count.exercises`, `likes`). |
| RF-05 | Ordenado por `UserFavorite.createdAt desc` por defecto. |

## 7. Requisitos no funcionales

- **Auth**: JWT obligatorio.
- **Performance**: trivial.

## 8. Criterios de aceptación

- [ ] Marcar como favorito 2 veces seguidas → no error.
- [ ] Desmarcar 2 veces seguidas → no error.
- [ ] Favoritar rutina privada ajena → 403.
- [ ] Favoritar rutina pública ajena → 201/204.
- [ ] `GET /users/me/favorites` solo retorna del usuario logueado.
- [ ] Borrar rutina (F-02 DELETE) elimina también el favorito (ya cubierto allí en la transacción).

## 9. Dependencias y riesgos

- **Dependencia**: F-02 (gestión rutinas) + F-03 (feed público) — pero técnicamente independientes.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §3.1
- Tareas: Fibery #60
- Archivos afectados:
  - `src/routines/routines.controller.ts` (o nuevo `favorites.controller.ts`)
  - `src/routines/routines.service.ts`
  - `src/users/users.controller.ts` (para `GET /users/me/favorites`)
