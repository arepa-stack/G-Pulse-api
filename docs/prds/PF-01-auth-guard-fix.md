# PRD F-01 — Seguridad: AuthGuard en endpoints expuestos

| Campo | Valor |
|---|---|
| **Feature ID** | F-01 |
| **Sprint** | Sprint 1 |
| **Prioridad** | Alta (bloqueador MVP) |
| **Tareas Fibery** | #49, #50 |
| **Documento RFC** | [`../rfcs/RF-01-auth-guard-fix.md`](../rfcs/RF-01-auth-guard-fix.md) |

## 1. TL;DR

Hoy `POST /routines` y `POST /gemini/generate` aceptan un `userId` en el body y **no requieren JWT**. Cualquiera con acceso público a la API puede crear rutinas a nombre de otro usuario y consumir cuota de IA ajena. Esta feature cierra ese gap aplicando `AuthGuard('jwt')` a ambos endpoints y eliminando `userId` del body.

## 2. Contexto y problema

- **Hallazgo**: durante el análisis de gaps del MVP (ver `MVP_GAP_ANALYSIS.md` §2.2) se detectó que dos endpoints sensibles no usan el guard JWT global.
- **Impacto actual**:
  - **`POST /routines`**: cualquier atacante con la URL puede crear rutinas en cualquier cuenta. Esto contamina datos, infla métricas y permite spam.
  - **`POST /gemini/generate`**: un atacante puede agotar la cuota diaria de IA de cualquier usuario conocido (BASIC=1, PRO=3, EXPERT=5) e impactar la facturación con Google.
- **Riesgo regulatorio**: dado que se exponen datos personales, esto puede ser un hallazgo en una auditoría de seguridad básica.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Eliminar la posibilidad de operar como otro usuario | Cantidad de endpoints que aceptan `userId` por body sin auth | 0 |
| Validar que toda la suite de tests sigue verde | Tests pasando en CI | 100% |
| Documentar la API correctamente | Swagger refleja los endpoints como `bearerAuth` | Sí |

## 4. Alcance

### In scope
- Aplicar `@UseGuards(AuthGuard('jwt'))` y `@ApiBearerAuth()` a `POST /routines`.
- Aplicar lo mismo a `POST /gemini/generate`.
- Quitar el campo `userId` del `CreateRoutineDto` y del `GenerateTextDto`.
- Tomar el `userId` desde `req.user.id` dentro del controller.
- Actualizar tests unitarios y e2e correspondientes.
- Actualizar documentación Swagger.

### Out of scope
- Roles avanzados (esto solo es JWT estándar).
- Refactor de los servicios subyacentes (`RoutinesService.createRoutine`, `GeminiService.generateText`).
- Cambios en el sistema de cuotas IA (queda igual).

## 5. Usuarios y casos de uso

- **Actor**: cualquier usuario autenticado (rol `USER` o `ADMIN`).
- **Casos**:
  1. Usuario crea una rutina propia → ahora siempre va atada a su propio JWT.
  2. Usuario solicita una generación de texto a Gemini → la cuota se descuenta correctamente al usuario del JWT.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | `POST /routines` debe retornar `401 Unauthorized` si no se envía Bearer JWT válido. |
| RF-02 | El `creatorId` de la rutina creada debe tomarse del JWT, no del body. |
| RF-03 | `POST /gemini/generate` debe retornar `401 Unauthorized` sin JWT. |
| RF-04 | El `userId` usado por `GeminiService.checkQuota` debe tomarse del JWT. |
| RF-05 | Si el usuario del JWT no existe en BD → `401 Unauthorized` (manejado por `RolesGuard`/JWT strategy). |

## 7. Requisitos no funcionales

- **Compatibilidad**: cambio breaking en el contrato — los clientes deben actualizarse para no enviar `userId`. Coordinar release con frontend/app.
- **Performance**: cero impacto (un middleware adicional ya en uso en otros endpoints).
- **Auditabilidad**: el JWT valida también la existencia del usuario, por lo que cualquier operación queda trazable.

## 8. Criterios de aceptación

- [ ] `POST /routines` sin token → 401.
- [ ] `POST /routines` con JWT válido y body sin `userId` → 201, rutina creada con `creatorId = user.id`.
- [ ] `POST /routines` con JWT válido y body que incluye `userId` ajeno → el `userId` del body se ignora (o `400` por `forbidNonWhitelisted` si el DTO ya no lo declara).
- [ ] `POST /gemini/generate` sin token → 401.
- [ ] `POST /gemini/generate` con JWT válido → consume cuota del usuario del JWT.
- [ ] Swagger muestra ambos endpoints con el icono de candado.
- [ ] Tests existentes verdes + 2 tests nuevos para los 401.

## 9. Dependencias y riesgos

- **Dependencia**: la app móvil y panel admin deben actualizar sus clientes (quitar `userId` del payload).
- **Riesgo**: si se libera backend antes que clientes, los clientes verán errores 400/401. **Mitigación**: aceptar `userId` opcional pero ignorarlo durante 1 release de transición.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §2.2
- Tareas: Fibery #49, #50
- Archivos afectados:
  - `src/routines/routines.controller.ts`
  - `src/routines/dto/create-routine.dto.ts`
  - `src/gemini/gemini.controller.ts`
  - `src/gemini/dto/generate-text.dto.ts`
