# PRD F-15 — Hardening admin (DTO para `PATCH /admin/users/:id`)

| Campo | Valor |
|---|---|
| **Feature ID** | F-15 |
| **Sprint** | Sprint 4 |
| **Prioridad** | Media (deuda técnica de seguridad) |
| **Tareas Fibery** | #64 |
| **Documento RFC** | [`../rfcs/RF-15-admin-hardening.md`](../rfcs/RF-15-admin-hardening.md) |

## 1. TL;DR

Reemplazar el body type `Prisma.UserUpdateInput` (sin validación) en `PATCH /admin/users/:id` por un DTO formal con `class-validator` y limitar exactamente los campos permitidos. Reduce riesgo de actualizaciones imprevistas (cambio de email, `googleId`, contadores) por un admin.

## 2. Contexto y problema

- El endpoint `PATCH /admin/users/:id` acepta:
  ```ts
  Partial<Pick<Prisma.UserUpdateInput, 'name' | 'level' | 'plan' | 'role'>>
  ```
- El `Pick` es solo TypeScript en compile-time, no en runtime. Sin un DTO, el `ValidationPipe` global **no valida nada** y `forbidNonWhitelisted` no aplica.
- Esto permite que un admin envíe `{ aiPromptCount: 0, lastAiPromptDate: '...' }` y modifique campos sensibles.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Body fuertemente tipado en runtime | DTO + class-validator | Sí |
| Solo se modifican campos permitidos | `forbidNonWhitelisted` rechaza ajenos | Sí |
| Documentación Swagger precisa | Schema visible y correcto | Sí |

## 4. Alcance

### In scope
- Crear `UpdateUserAdminDto` con campos: `name?`, `level?`, `plan?`, `role?`.
- Validar enums.
- Reemplazar el tipo en el controller.
- Actualizar Swagger.

### Out of scope
- Endpoints de otros recursos admin (los demás ya tienen DTOs).

## 5. Usuarios y casos de uso

- **Actor**: admin.
- **Caso**: cambiar plan o rol de un usuario sin riesgo de tocar otros campos.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | DTO acepta únicamente `name`, `level`, `plan`, `role` (todos opcionales). |
| RF-02 | `level` debe ser `UserLevel` válido. |
| RF-03 | `plan` debe ser `SubscriptionPlan` válido. |
| RF-04 | `role` debe ser `Role` válido. |
| RF-05 | Payload con campos extra → 400 (gracias al `ValidationPipe` global con `forbidNonWhitelisted=true`). |

## 7. Requisitos no funcionales

- **Compatibilidad**: si algún cliente legítimo envía hoy `aiPromptCount`, romperá. Verificar logs.

## 8. Criterios de aceptación

- [ ] DTO importado y usado.
- [ ] Body con `aiPromptCount` → 400.
- [ ] Body con `role: 'INVALID'` → 400.
- [ ] Body válido sigue funcionando.
- [ ] Swagger refleja el schema.

## 9. Dependencias y riesgos

- Bajo riesgo. Único cliente debería ser el panel admin que controlamos.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §4.4
- Tareas: Fibery #64
- Archivos afectados:
  - `src/admin/dto/update-user-admin.dto.ts` (nuevo)
  - `src/admin/admin.controller.ts`
