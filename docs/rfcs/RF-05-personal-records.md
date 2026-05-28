# RFC F-05 — Records personales (PRs)

| Campo | Valor |
|---|---|
| **Feature ID** | F-05 |
| **PRD asociado** | [`../prds/PF-05-personal-records.md`](../prds/PF-05-personal-records.md) |
| **Status** | Propuesto |
| **Esfuerzo** | S-M (1-2 días) |

## 1. TL;DR

Agregar `GET /progress/prs` calculando PRs en runtime con un query SQL agrupado. Sin cambios en schema (depende del modelo `WorkoutSet` de F-04).

## 2. Contexto técnico

- Depende de `WorkoutSet` (F-04).
- Postgres permite agregaciones con `GROUP BY` muy eficientes.

## 3. Diseño propuesto

### 3.1 Fórmula 1RM

Epley:

```
1RM ≈ weightKg * (1 + reps / 30)
```

Para `reps == 1`: `1RM == weightKg`.
Para `reps > 12`: ignorar (resultado no confiable).

### 3.2 Endpoint

```typescript
@Get('prs')
@ApiOperation({ summary: 'Get personal records by exercise for the logged user' })
async getPrs(@Request() req, @Query('exerciseId') exerciseId?: string) {
  return this.progressService.getPersonalRecords(req.user.id, exerciseId);
}
```

### 3.3 Service

Estrategia: dos queries agrupadas.

```typescript
async getPersonalRecords(userId: string, exerciseId?: string) {
  // 1) Bring all eligible sets, joined to the activity log to filter by user
  const sets = await this.prisma.workoutSet.findMany({
    where: {
      activityLog: { userId },
      completed: true,
      reps: { gt: 0, lte: 12 },
      weightKg: { gt: 0 },
      ...(exerciseId && { exerciseId }),
    },
    select: {
      id: true,
      exerciseId: true,
      weightKg: true,
      reps: true,
      createdAt: true,
      exercise: { select: { name: true, images: { take: 1, select: { url: true } } } },
    },
  });

  // 2) Reduce client-side por exerciseId (cantidades manejables)
  const byExercise = new Map<string, any>();
  for (const s of sets) {
    const oneRm = s.weightKg! * (1 + s.reps! / 30);
    const cur = byExercise.get(s.exerciseId);
    if (!cur) {
      byExercise.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        exerciseName: s.exercise.name,
        imageUrl: s.exercise.images[0]?.url ?? null,
        maxWeightKg: s.weightKg,
        maxWeightDate: s.createdAt,
        bestOneRm: oneRm,
        bestOneRmDate: s.createdAt,
        bestOneRmSetId: s.id,
      });
    } else {
      if (s.weightKg! > cur.maxWeightKg) {
        cur.maxWeightKg = s.weightKg;
        cur.maxWeightDate = s.createdAt;
      }
      if (oneRm > cur.bestOneRm) {
        cur.bestOneRm = oneRm;
        cur.bestOneRmDate = s.createdAt;
        cur.bestOneRmSetId = s.id;
      }
    }
  }
  return Array.from(byExercise.values()).sort((a, b) => b.bestOneRm - a.bestOneRm);
}
```

> **Alternativa SQL nativa** con `$queryRaw` y `DISTINCT ON` para los conjuntos grandes — ver §4.

### 3.4 Response shape

```json
[
  {
    "exerciseId": "uuid",
    "exerciseName": "Bench Press",
    "imageUrl": "https://...",
    "maxWeightKg": 120,
    "maxWeightDate": "2026-05-12T10:00:00Z",
    "bestOneRm": 145.2,
    "bestOneRmDate": "2026-05-12T10:00:00Z",
    "bestOneRmSetId": "uuid-of-set"
  }
]
```

## 4. Alternativas consideradas

### Opción A — Cálculo en aplicación (propuesta inicial)
- Pros: simple, fácil de testear.
- Contras: trae todos los sets (~5K) a memoria por request. Aceptable hasta ~50K sets/usuario.

### Opción B — SQL nativo con `DISTINCT ON`
```sql
SELECT DISTINCT ON (ws.exercise_id)
  ws.exercise_id,
  ws.weight_kg * (1 + ws.reps::float / 30) AS one_rm,
  ws.weight_kg,
  ws.reps,
  ws.created_at,
  ws.id
FROM workout_set ws
JOIN activity_log al ON al.id = ws.activity_log_id
WHERE al.user_id = $1
  AND ws.completed = true
  AND ws.reps > 0 AND ws.reps <= 12
  AND ws.weight_kg > 0
ORDER BY ws.exercise_id, one_rm DESC;
```

- Pros: O(N) en DB, no transfiere todos los sets.
- Contras: requiere `$queryRaw`, pierde tipado fuerte. Lo dejamos para v2 si el approach A se vuelve lento.

### Opción C — Tabla `PersonalRecord` cacheada
- Mantener un registro materializado actualizado on-write.
- Pros: lectura O(1).
- Contras: complejidad, sincronización. **Rechazado** para MVP.

## 5. Migraciones / compatibilidad

- Ninguna migración.
- Sin breaking changes.

## 6. Seguridad

- Filtra por `activityLog.userId`. Sin posibilidad de leakage.

## 7. Performance

- Para usuarios típicos (1-2K sets) opción A es instantánea.
- Si la suma de sets supera 50K por usuario, evaluar opción B o cache.

## 8. Testing

### Unit
- Sets con reps > 12 se ignoran.
- Sets `completed=false` se ignoran.
- Cálculo Epley correcto.
- `?exerciseId` filtra.

### E2E
- `GET /progress/prs` ajeno → 200 con lista vacía (no encuentra sets del usuario).

## 9. Plan de rollout

| Día | Acción |
|---|---|
| D0 | Implementación + tests. |
| D1 | Deploy a staging. |
| D2 | Producción. |
| Semana 4 | Revisar métricas de uso y latencia; decidir si vale opción B. |

## 10. Open questions

- ¿Mostrar PRs solo del último año por defecto? Decisión de producto.
- ¿Notificar al usuario cuando hace un PR (push)? → Cubierto por F-10.
- ¿Soportar otras fórmulas 1RM (Brzycki, Lombardi)? Probablemente no para MVP.
