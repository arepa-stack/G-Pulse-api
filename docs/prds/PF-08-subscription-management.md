# PRD F-08 — Gestión de suscripción (estado y cancelación)

| Campo | Valor |
|---|---|
| **Feature ID** | F-08 |
| **Sprint** | Sprint 3 (+ cron de F-08 en Post-S4) |
| **Prioridad** | Media |
| **Tareas Fibery** | #62, #71 |
| **Documento RFC** | [`../rfcs/RF-08-subscription-management.md`](../rfcs/RF-08-subscription-management.md) |

## 1. TL;DR

Hoy el usuario puede **subir** de plan (`POST /subscriptions/upgrade`) pero **no puede consultar su estado actual ni cancelar**. Tampoco hay job que expire la suscripción al pasar `endDate`. Esta feature cierra ese flujo.

## 2. Contexto y problema

- `Subscription` se crea/actualiza al hacer upgrade con `startDate=now`, `endDate=now + 1 mes`, `isActive=true`.
- Sin endpoint de cancelación: el usuario no puede salir del plan ni recuperar BASIC.
- Sin job de expiración: aunque `endDate` pase, `isActive` queda `true` y `user.plan` no cambia.
- Esto rompe las cuotas de IA (un PRO expirado sigue teniendo 3/día).

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Permitir consultar y cancelar suscripción | 2 endpoints + 1 cron | Sí |
| Cuotas consistentes con plan activo | % de usuarios con `Subscription.endDate < now` y plan ≠ BASIC | 0% |
| Transparencia | Endpoint que retorna `endDate`, `isActive`, `plan` | Sí |

## 4. Alcance

### In scope
- `GET /subscriptions/me` — devuelve estado de la suscripción del usuario logueado.
- `POST /subscriptions/cancel` — cancela: `isActive=false`, `endDate=now`. Mantiene plan hasta `endDate` (no downgrade inmediato).
- Cron job diario que: cambia a `BASIC` y `isActive=false` cuando `endDate < now`.

### Out of scope
- Renovación automática (suscripción recurrente con pasarela real).
- Pasarela de pago (Stripe, etc.) — sigue siendo mock.
- Pro-rateo / reembolsos.

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado.
- **Casos**:
  1. "¿Cuándo me vence mi suscripción?" → `GET /subscriptions/me`.
  2. "Quiero cancelar pero seguir usando hasta fin de mes" → `POST /subscriptions/cancel`.
  3. "El sistema debe bajarme automáticamente cuando expire" → cron diario.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | `GET /subscriptions/me` retorna `{ plan, isActive, startDate, endDate, daysRemaining }`. |
| RF-02 | Si el usuario nunca tuvo `Subscription` (BASIC default) → retornar `{ plan: 'BASIC', isActive: false, startDate: null, endDate: null, daysRemaining: null }`. |
| RF-03 | `POST /subscriptions/cancel` marca `isActive=false` y `endDate=now`. **No** cambia `user.plan` inmediatamente. |
| RF-04 | Cron diario: para cada `Subscription` con `isActive=true` y `endDate < now` o `isActive=false` y `endDate < now` y `user.plan != BASIC`: ejecutar downgrade. |
| RF-05 | Al hacer downgrade automático: `user.plan = BASIC`, log de la acción. |

## 7. Requisitos no funcionales

- **Auth**: JWT obligatorio (`GET /subscriptions/me`, `POST /subscriptions/cancel`).
- **Idempotencia**: cancelar 2 veces no debe romper nada.
- **Observabilidad**: el cron debe loguear cuántos usuarios fueron downgradeados.

## 8. Criterios de aceptación

- [ ] `GET /subscriptions/me` sin suscripción → 200 con BASIC default.
- [ ] `POST /subscriptions/cancel` en suscripción activa → `isActive=false`, plan **sigue** intacto.
- [ ] Cron simulado con fecha futura → usuarios con `endDate < hoy` bajan a BASIC.
- [ ] Cuotas de IA recalculan según el plan activo (cubierto por `GeminiService.checkQuota` existente que lee `user.plan`).

## 9. Dependencias y riesgos

- **Riesgo**: doble cancelación. Mitigado por idempotencia.
- **Riesgo**: cron no ejecuta. Mitigado con logging + alerta.
- **Dependencia futura**: integración real con pasarela de pago (Stripe webhooks reemplazarían parte de este flujo).

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §4.3
- Tareas: Fibery #62 (endpoints), #71 (cron)
- Archivos afectados:
  - `src/subscriptions/subscriptions.controller.ts`
  - `src/subscriptions/subscriptions.service.ts`
  - `src/subscriptions/subscriptions.cron.ts` (nuevo)
  - `src/app.module.ts` (importar `ScheduleModule`)
