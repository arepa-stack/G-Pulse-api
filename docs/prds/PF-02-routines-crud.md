# PRD F-02 — Gestión de rutinas del usuario (CRUD)

| Campo | Valor |
|---|---|
| **Feature ID** | F-02 |
| **Sprint** | Sprint 1 |
| **Prioridad** | Alta (bloqueador MVP) |
| **Tareas Fibery** | #51, #52, #53, #54 |
| **Documento RFC** | [`../rfcs/RF-02-routines-crud.md`](../rfcs/RF-02-routines-crud.md) |

## 1. TL;DR

Hoy un usuario puede **crear** rutinas pero no puede listarlas, abrirlas, modificarlas ni eliminarlas. Esta feature cierra el ciclo CRUD exponiendo `GET /routines`, `GET /routines/:id`, `PATCH /routines/:id` y `DELETE /routines/:id` con autorización por propietario.

## 2. Contexto y problema

- El modelo `Routine` en Prisma ya soporta todas las operaciones (`creatorId`, `exercises[]`, `isPublic`, `likes`).
- Solo existe `POST /routines` para usuarios; `GET` / `PATCH` / `DELETE` solo existen para admin (`/admin/routines/...`).
- Sin esta feature un usuario crea una rutina y nunca puede volver a abrirla → el ciclo principal "ver mi rutina → entrenarla" está roto.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Cerrar el ciclo CRUD de rutinas | 4 endpoints nuevos funcionando | 4/4 |
| Autorización por propietario | % de tests que validan acceso ajeno | 100% |
| Performance del listado | p95 latency con 50 rutinas | < 200 ms |

## 4. Alcance

### In scope
- `GET /routines` → lista rutinas del usuario autenticado (con paginación).
- `GET /routines/:id` → detalle de una rutina (solo del propietario, salvo si es `isPublic`).
- `PATCH /routines/:id` → actualizar campos básicos (name, description, isPublic) y reemplazar lista de ejercicios.
- `DELETE /routines/:id` → eliminar rutina + sus `RoutineExercise` + `UserFavorite` en transacción.

### Out of scope
- Compartir rutinas con otros usuarios específicos (solo `isPublic` global).
- Versionado / historial de cambios.
- Duplicar rutina (`POST /routines/:id/duplicate`) — se evalúa para una feature posterior.

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado (cualquier rol).
- **Casos**:
  1. "Quiero ver mis rutinas para elegir cuál entrenar hoy" → `GET /routines`.
  2. "Quiero abrir mi rutina de pecho para empezar a entrenar" → `GET /routines/:id`.
  3. "Quiero agregar un ejercicio nuevo a mi rutina" → `PATCH /routines/:id`.
  4. "Quiero borrar la rutina vieja que ya no uso" → `DELETE /routines/:id`.
  5. "Quiero ver una rutina pública que vi en el feed" → `GET /routines/:id` con rutina `isPublic=true`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | `GET /routines` retorna solo rutinas con `creatorId === req.user.id`. |
| RF-02 | `GET /routines` soporta paginación (`page`, `limit`, default 1/20). |
| RF-03 | `GET /routines/:id` retorna 404 si no existe; 403 si existe pero no es del usuario y no es pública. |
| RF-04 | `GET /routines/:id` incluye `exercises[]` con `Exercise` anidado y orden ascendente. |
| RF-05 | `PATCH /routines/:id` solo es exitoso para el propietario; 403 en caso contrario. |
| RF-06 | `PATCH /routines/:id` si recibe `exercises`, reemplaza la lista completa (delete + insert dentro de transacción). |
| RF-07 | `DELETE /routines/:id` borra en transacción: `RoutineExercise`, `UserFavorite`, `Routine`. 404 si no existe. 403 si no es del usuario. |
| RF-08 | `DELETE /routines/:id` no debe afectar `ActivityLog` históricos (su FK `routineId` queda en `null`). |

## 7. Requisitos no funcionales

- **Autorización**: todos los endpoints bajo `AuthGuard('jwt')`.
- **Validación**: usar `class-validator` con DTOs.
- **Performance**: `findMany` con `include` de `exercises.exercise.images` debe ejecutarse en < 200 ms p95 para listas de ≤ 50 rutinas.
- **Consistencia**: las operaciones que tocan múltiples tablas deben ir en transacción Prisma.

## 8. Criterios de aceptación

- [ ] `GET /routines` sin token → 401.
- [ ] `GET /routines` con JWT → retorna solo rutinas del usuario, paginadas.
- [ ] `GET /routines/:id` propio → 200 con detalle completo (ejercicios ordenados).
- [ ] `GET /routines/:id` de otro usuario y `isPublic=false` → 403.
- [ ] `GET /routines/:id` de otro usuario y `isPublic=true` → 200.
- [ ] `PATCH /routines/:id` propio → 200, cambios aplicados.
- [ ] `PATCH /routines/:id` ajeno → 403.
- [ ] `DELETE /routines/:id` propio → 204, registros relacionados borrados, `ActivityLog.routineId` queda `null`.
- [ ] Tests unitarios para `RoutinesService` y e2e para los 4 endpoints.

## 9. Dependencias y riesgos

- **Dependencia bloqueante**: F-01 (AuthGuard) debe estar en place primero.
- **Riesgo**: el `schema.prisma` actual define `ActivityLog.routineId` como `String?` con relación opcional, pero hay que confirmar que `onDelete: SetNull` esté configurado (o agregar `onDelete: SetNull` en la migración).
- **Riesgo**: si el usuario tiene mucho histórico, `findUnique` con todos los includes puede ser caro. **Mitigación**: incluir solo lo necesario y soportar `?expand=exercises` opcional en una iteración futura.

## 10. Referencias

- `PROJECT_MAP.md` §6.4 y §6.8
- `MVP_GAP_ANALYSIS.md` §2.1
- Tareas: Fibery #51, #52, #53, #54
- Archivos afectados:
  - `src/routines/routines.controller.ts`
  - `src/routines/routines.service.ts`
  - `src/routines/dto/update-routine.dto.ts` (nuevo)
  - `prisma/schema.prisma` (revisar `onDelete` de `ActivityLog.routine`)
