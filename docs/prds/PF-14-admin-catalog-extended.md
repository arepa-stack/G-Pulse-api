# PRD F-14 — Catálogo extendido (admin: músculos / categorías)

| Campo | Valor |
|---|---|
| **Feature ID** | F-14 |
| **Sprint** | Post-S4 |
| **Prioridad** | Baja |
| **Tareas Fibery** | #69, #70 |
| **Documento RFC** | [`../rfcs/RF-14-admin-catalog-extended.md`](../rfcs/RF-14-admin-catalog-extended.md) |

## 1. TL;DR

Permitir al admin crear, editar y borrar entidades de catálogo (`Muscle`, `Category`) desde la API. Hoy solo se siembran vía seed → cualquier ajuste requiere migración + redeploy.

## 2. Contexto y problema

- `Exercise.categoryId` y la relación many-to-many con `Muscle` ya existen.
- No hay endpoints para mantener estos catálogos.
- Cuando el admin necesita agregar un músculo nuevo ("forearms"), hoy tiene que ejecutar SQL o re-correr seed.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Catálogo mantenible | CRUD funcional | Sí |
| Sin downtime para cambios | Operaciones online | Sí |

## 4. Alcance

### In scope
- `POST/GET/PATCH/DELETE /admin/muscles`.
- `POST/GET/PATCH/DELETE /admin/categories`.
- Validar unicidad por `name`.
- Bloquear borrado si hay ejercicios usando ese músculo / categoría (o requerir `?force=true`).

### Out of scope
- Endpoints públicos para listar músculos / categorías (puede agregarse en otra feature).
- Internacionalización del catálogo.

## 5. Usuarios y casos de uso

- **Actor**: admin.
- **Casos**:
  1. "Agregar 'antebrazos' a la lista de músculos" → `POST /admin/muscles`.
  2. "Renombrar 'biceps' a 'Bíceps'" → `PATCH /admin/muscles/:id`.
  3. "Borrar la categoría 'Plyometrics' obsoleta" → `DELETE /admin/categories/:id`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | Endpoints bajo `JWT + RolesGuard(ADMIN)`. |
| RF-02 | `name` único; 409 en conflicto. |
| RF-03 | `DELETE` debe verificar referencias y devolver 409 si existen, salvo `?force=true`. |
| RF-04 | `Muscle.target` opcional (`'arms'`, `'legs'`, ...). |

## 7. Requisitos no funcionales

- **Auth**: ADMIN.
- **Performance**: trivial.

## 8. Criterios de aceptación

> Estado: músculos (Fibery #69) ✅ y categorías (Fibery #70) ✅ implementados con tests unitarios.

- [x] Crear músculo nuevo → 201.
- [x] Duplicar nombre → 409.
- [x] Borrar músculo en uso sin `force` → 409 con el conteo (`references`) de ejercicios que lo usan.
- [x] Borrar con `?force=true` → desasocia y borra (en transacción).

## 9. Dependencias y riesgos

- Sin dependencias técnicas externas.
- **Riesgo**: borrar accidentalmente un músculo masivo. Mitigado por chequeo de referencias.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §4.1
- Tareas: Fibery #69, #70
- Archivos afectados:
  - `src/admin/admin.controller.ts`
  - `src/admin/admin.service.ts`
  - `src/admin/dto/{create,update}-{muscle,category}.dto.ts`
