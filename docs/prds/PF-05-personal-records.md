# PRD F-05 — Records personales (PRs)

| Campo | Valor |
|---|---|
| **Feature ID** | F-05 |
| **Sprint** | Sprint 2 |
| **Prioridad** | Alta (motor de engagement) |
| **Tareas Fibery** | #59 |
| **Documento RFC** | [`../rfcs/RF-05-personal-records.md`](../rfcs/RF-05-personal-records.md) |

## 1. TL;DR

Exponer `GET /progress/prs` que devuelva, por ejercicio del usuario, su **peso máximo levantado**, su **mejor 1RM estimado** y la **fecha** en que lo logró. Es el feature que enciende la motivación recurrente y refuerza la retención semanal.

## 2. Contexto y problema

- Los PRs son la métrica universal de progreso en gimnasio (peso, reps, etc.).
- Sin PRs el usuario no tiene un "highscore" que perseguir.
- Hoy no hay forma de calcularlos porque no existe `WorkoutSet`. Esta feature **depende de F-04**.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Visibilizar progreso | Endpoint `GET /progress/prs` operativo | Sí |
| Latencia aceptable con 1 año de datos | p95 con 5K sets | < 300 ms |
| Cobertura | % de usuarios activos con ≥ 1 PR registrado tras 1 semana | ≥ 50% |

## 4. Alcance

### In scope
- `GET /progress/prs` retorna lista de ejercicios con `maxWeightKg`, `maxReps`, `bestOneRm` (Epley), `date` y `setId` que lo logró.
- Filtro opcional `?exerciseId=:id` para detallar un solo ejercicio.
- Considerar solo sets con `completed=true`.

### Out of scope
- Notificación push automática al lograr un PR (queda como dependiente de F-10).
- PRs por número de reps a un peso fijo (3RM, 5RM) — agregable en v2.
- PRs por volumen total — v2.

## 5. Usuarios y casos de uso

- **Actor**: usuario autenticado.
- **Casos**:
  1. "Quiero ver todos mis PRs por ejercicio" → `GET /progress/prs`.
  2. "Quiero ver mi PR de press de banca" → `GET /progress/prs?exerciseId=...`.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | Solo computar sets con `completed=true` y `reps > 0` y `weightKg > 0`. |
| RF-02 | `maxWeightKg`: peso máximo levantado independiente de reps. |
| RF-03 | `bestOneRm`: máximo de `weightKg * (1 + reps/30)` (fórmula de Epley) — válido para reps ≤ 12; para reps > 12 ignorar (poco confiable). |
| RF-04 | `date`: fecha del set que logró el `bestOneRm`. |
| RF-05 | Respuesta incluye nombre del ejercicio y opcional URL de imagen primaria. |
| RF-06 | Endpoint solo retorna PRs del usuario autenticado. |
| RF-07 | Si no hay sets para el usuario → lista vacía, no error. |

## 7. Requisitos no funcionales

- **Performance**: query con 5K sets en < 300 ms p95. Se acepta cachear en memoria por 5 min si fuera necesario.
- **Auth**: JWT obligatorio.

## 8. Criterios de aceptación

- [ ] Sin sets → 200 con `[]`.
- [ ] Con sets en bench press: `bestOneRm` correcto según Epley.
- [ ] Sets con `completed=false` se ignoran.
- [ ] `?exerciseId` filtra correctamente.
- [ ] Test con sets de varios usuarios: solo se ve lo propio.

## 9. Dependencias y riesgos

- **Dependencia bloqueante**: F-04 (WorkoutSet).
- **Riesgo**: Epley es inexacto para reps muy altas. **Mitigación**: limitar a reps ≤ 12 para `bestOneRm`. Documentar.

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §3.2
- Tareas: Fibery #59
- Archivos afectados:
  - `src/progress/progress.controller.ts`
  - `src/progress/progress.service.ts`
