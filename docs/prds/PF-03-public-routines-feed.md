# PRD F-03 — Feed público de rutinas

| Campo | Valor |
|---|---|
| **Feature ID** | F-03 |
| **Sprint** | Sprint 1 |
| **Prioridad** | Alta (descubrimiento social del MVP) |
| **Tareas Fibery** | #55 |
| **Documento RFC** | [`../rfcs/RF-03-public-routines-feed.md`](../rfcs/RF-03-public-routines-feed.md) |

## 1. TL;DR

Exponer `GET /routines/public` para que los usuarios puedan **descubrir rutinas creadas por otros** que estén marcadas como públicas (`isPublic=true`). Es el primer paso hacia el componente social del MVP y desbloquea valor inmediato (catálogo de rutinas curadas + creadas por la comunidad).

## 2. Contexto y problema

- El modelo `Routine` ya tiene los campos `isPublic` (bool) y `likes` (int).
- El endpoint `POST /routines` permite marcar `isPublic=true`, pero **nadie puede ver esas rutinas públicas** porque no existe un endpoint para listarlas.
- Sin descubrimiento, el sistema actúa como una "agenda personal" en vez de una app de gym.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Habilitar descubrimiento de rutinas | Endpoint público funcionando | Sí |
| Calidad del feed | % de rutinas con ≥1 ejercicio | ≥ 95% |
| Performance | p95 latency con 1000 rutinas | < 250 ms |

## 4. Alcance

### In scope
- `GET /routines/public` con paginación, búsqueda por nombre y orden por `likes` o `createdAt`.
- Cada item incluye: `id`, `name`, `description`, `likes`, `createdAt`, `creator.name`, cantidad de ejercicios.
- Filtrar rutinas vacías (sin ejercicios).

### Out of scope
- Algoritmo de recomendación personalizado.
- Categorías / tags de rutinas (modelo no lo soporta hoy).
- Moderación / reportes (post-MVP).

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado (también podría ser anónimo, pero por simetría exige JWT).
- **Casos**:
  1. "Quiero ver las rutinas más populares para inspirarme" → `GET /routines/public?sort=likes`.
  2. "Quiero ver rutinas nuevas que la gente está creando" → `GET /routines/public?sort=recent`.
  3. "Quiero buscar una rutina de pecho" → `GET /routines/public?search=pecho`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | `GET /routines/public` retorna solo rutinas con `isPublic=true`. |
| RF-02 | Soporta paginación (`page`, `limit`, default 1/20, máx 50). |
| RF-03 | Soporta búsqueda case-insensitive por `name` (`?search=...`). |
| RF-04 | Soporta orden: `?sort=likes` (desc), `?sort=recent` (createdAt desc), default `recent`. |
| RF-05 | Cada item incluye `creator.name` (no email). |
| RF-06 | Cada item incluye `_count.exercises`. |
| RF-07 | Excluye rutinas sin ejercicios (`exercises.some` con count > 0) — opcional para evitar feed sucio. |

## 7. Requisitos no funcionales

- **Auth**: requiere JWT (`AuthGuard('jwt')`).
- **Performance**: p95 < 250 ms con 1000 rutinas. Indexar `isPublic, likes desc` y `isPublic, createdAt desc` si el feed crece.
- **Privacidad**: no exponer datos privados del creador (solo `name`).

## 8. Criterios de aceptación

- [ ] `GET /routines/public` sin token → 401.
- [ ] `GET /routines/public` con JWT → lista solo `isPublic=true`.
- [ ] Cada item tiene `creator.name`, **no** tiene `creator.email` ni `creatorId`.
- [ ] `?sort=likes` ordena descendente por likes.
- [ ] `?sort=recent` (default) ordena descendente por `createdAt`.
- [ ] `?search=foo` filtra por nombre case-insensitive.
- [ ] Pagination meta correcta.

## 9. Dependencias y riesgos

- **Dependencia**: F-01 (AuthGuard) — ya cubierta porque este endpoint nace con guard.
- **Riesgo**: spam de rutinas públicas vacías o de prueba. **Mitigación**: filtrar rutinas con 0 ejercicios.
- **Riesgo**: rutinas públicas con contenido inapropiado. **Mitigación post-MVP**: agregar flag de moderación y endpoint admin de oculto.

## 10. Referencias

- `PROJECT_MAP.md` §6.4
- `MVP_GAP_ANALYSIS.md` §2.4
- Tareas: Fibery #55
- Archivos afectados:
  - `src/routines/routines.controller.ts`
  - `src/routines/routines.service.ts`
  - `src/routines/dto/find-public-routines.dto.ts` (nuevo)
