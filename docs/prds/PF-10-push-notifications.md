# PRD F-10 — Notificaciones push (FCM)

| Campo | Valor |
|---|---|
| **Feature ID** | F-10 |
| **Sprint** | Sprint 4 |
| **Prioridad** | Media (alto impacto en retención) |
| **Tareas Fibery** | #65 |
| **Documento RFC** | [`../rfcs/RF-10-push-notifications.md`](../rfcs/RF-10-push-notifications.md) |

## 1. TL;DR

Habilitar notificaciones push via Firebase Cloud Messaging (FCM) para enviar recordatorios de entrenamiento, hitos (rachas, PRs) y mensajes transaccionales. El proyecto ya usa Firebase Admin, así que la integración es directa.

## 2. Contexto y problema

- Una app de gym sin push pierde la retención principal (recordatorios al usuario que se olvida).
- Hoy `firebase-admin` está integrado solo para verificación de tokens Google → se aprovecha la misma infraestructura.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Habilitar envío de push | Endpoint `register-token` + servicio de envío | Sí |
| Retención | DAU/WAU mejorado tras campaña de recordatorios | +10% |
| Configurabilidad | Usuario puede pausar notificaciones | Sí |

## 4. Alcance

### In scope
- Modelo `DeviceToken` con campos `userId`, `token`, `platform` (`ios` | `android` | `web`), `lastSeenAt`.
- `POST /notifications/register-token` para que el cliente registre el FCM token tras login.
- `DELETE /notifications/register-token` para logout.
- Servicio `PushService` con métodos:
  - `sendToUser(userId, payload)`
  - `sendToUsers(userIds[], payload)`
- Disparo automático en:
  - Confirmación de un PR conseguido (depende de F-05 + lógica de detección).
  - Cancelación de suscripción (notificar que se downgradeará en X días).
  - Aplausos por racha (≥7, 14, 30 días — disparado tras `POST /progress/log`).
- Preferencias del usuario: `User.pushEnabled` boolean.

### Out of scope
- Notificaciones programadas tipo "hoy te toca entrenar" (requiere F-12 calendario).
- Email + push deduplicación (cada canal independiente).
- A/B testing de mensajes.

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado con la app móvil.
- **Casos**:
  1. "Acabo de hacer un PR en sentadilla, recibo notificación de felicitación".
  2. "Cumplí 7 días seguidos entrenando, recibo aplausos".
  3. "Pausé push porque me molesta" → `PATCH /users/profile { pushEnabled: false }`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | Cliente registra su FCM token tras login con `POST /notifications/register-token`. |
| RF-02 | Un usuario puede tener múltiples device tokens (varios dispositivos). |
| RF-03 | Al hacer logout: `DELETE /notifications/register-token` con el token específico. |
| RF-04 | Token inválido detectado por FCM → marcar/borrar de BD. |
| RF-05 | Si `user.pushEnabled = false`, no enviar push aunque haya tokens. |
| RF-06 | Send falla → log + retry una vez. |

## 7. Requisitos no funcionales

- **Privacy**: no enviar PII en el payload del push.
- **Performance**: send async, no bloquear request principal.
- **Auth**: registro de token requiere JWT.

## 8. Criterios de aceptación

- [ ] Registro de token nuevo crea entrada en `DeviceToken`.
- [ ] Re-registro del mismo token (upsert) actualiza `lastSeenAt`.
- [ ] Push a usuario con varios tokens → todos reciben.
- [ ] Push a usuario con `pushEnabled=false` → no se envía.
- [ ] Token marcado como inválido por FCM se borra de BD.

## 9. Dependencias y riesgos

- **Dependencia**: app móvil debe implementar FCM SDK (cliente).
- **Riesgo**: tokens caducan silenciosamente; mitigar marcándolos como inválidos al primer error.
- **Riesgo**: spam si la lógica se equivoca y manda repetido. **Mitigación**: dedupe por `(userId, type, key)` en una capa de notificaciones (futuro).

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §4.5
- Tareas: Fibery #65
- Archivos afectados:
  - `prisma/schema.prisma` (nuevo modelo + flag en User)
  - `src/notifications/` (módulo nuevo)
  - Hooks en `ProgressService` (rachas, PRs), `SubscriptionsService` (cancelación)
