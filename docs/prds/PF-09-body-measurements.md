# PRD F-09 — Mediciones corporales

| Campo | Valor |
|---|---|
| **Feature ID** | F-09 |
| **Sprint** | Sprint 4 |
| **Prioridad** | Media |
| **Tareas Fibery** | #63 |
| **Documento RFC** | [`../rfcs/RF-09-body-measurements.md`](../rfcs/RF-09-body-measurements.md) |

## 1. TL;DR

Permitir al usuario registrar mediciones corporales (peso, % grasa, cintura, pecho, brazo, pierna) a lo largo del tiempo y consultarlas para ver evolución. Es parte de la motivación tangible: "perder peso" o "ganar masa".

## 2. Contexto y problema

- App de gym sin tracking de peso corporal pierde un caso de uso central.
- Hoy `User` solo tiene `level` y `plan`; no hay forma de registrar evolución física.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Permitir tracking corporal | Modelo + 3 endpoints | Sí |
| Adopción | % usuarios con ≥ 1 medición tras 2 semanas | ≥ 20% |
| Visualización temporal | Endpoint retorna serie ordenada | Sí |

## 4. Alcance

### In scope
- Nuevo modelo `BodyMeasurement`.
- `POST /measurements` — crear medición.
- `GET /measurements` — listar mediciones (paginadas).
- `DELETE /measurements/:id` — eliminar una medición.
- `GET /measurements/latest` — última medición de cada métrica.

### Out of scope
- Fotos de progreso (cubierto por F-13).
- Estimación automática de grasa por foto.
- Gráficas server-side; las renderiza el cliente con los datos.

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado.
- **Casos**:
  1. "Esta mañana me pesé en 82.3 kg" → `POST /measurements` con `weightKg`.
  2. "Quiero ver mi evolución de peso del último mes" → `GET /measurements?metric=weight&from=...`.
  3. "Quiero saber mi última medición de cintura" → `GET /measurements/latest`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | `BodyMeasurement` permite registrar opcionalmente: `weightKg`, `bodyFatPct`, `waistCm`, `chestCm`, `armCm`, `legCm`, `hipCm`. |
| RF-02 | Al menos un campo numérico debe estar presente. |
| RF-03 | Campo `notes?` opcional. |
| RF-04 | `date` por defecto = ahora; el usuario puede sobreescribirlo. |
| RF-05 | Endpoints solo retornan mediciones del usuario logueado. |
| RF-06 | `GET /measurements` soporta `?from=&to=&page=&limit=`. |
| RF-07 | `GET /measurements/latest` devuelve la última medición por métrica (no necesariamente del mismo registro). |

## 7. Requisitos no funcionales

- **Auth**: JWT obligatorio.
- **Validación**: rangos sanos (`weightKg` 20-300, `bodyFatPct` 3-60, `waistCm` 30-200, etc.).

## 8. Criterios de aceptación

- [ ] `POST /measurements` con todos los campos nulos → 400.
- [ ] `POST /measurements` con `weightKg=85.2` → 201.
- [ ] `GET /measurements?from=2026-01-01&to=2026-03-01` filtra correctamente.
- [ ] `GET /measurements/latest` retorna el último de cada campo.
- [ ] `DELETE /measurements/:id` propio → 204; ajeno → 403.

## 9. Dependencias y riesgos

- Sin dependencias técnicas externas.
- **Riesgo**: usuarios usando unidades imperiales (lb, in). **Mitigación**: el cliente convierte; el server siempre almacena métrico.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §3.3
- Tareas: Fibery #63
- Archivos afectados:
  - `prisma/schema.prisma` (nuevo modelo)
  - `src/measurements/` (módulo nuevo: module, controller, service, dtos)
  - `src/app.module.ts`
