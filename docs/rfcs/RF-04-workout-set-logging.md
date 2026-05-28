# RFC F-04 — Workout logging detallado (WorkoutSet)

| Campo | Valor |
|---|---|
| **Feature ID** | F-04 |
| **PRD asociado** | [`../prds/PF-04-workout-set-logging.md`](../prds/PF-04-workout-set-logging.md) |
| **Status** | Propuesto |
| **Esfuerzo** | L (3-5 días) |

## 1. TL;DR

Agregar modelo `WorkoutSet` y refactorizar `POST /progress/log` para aceptar sets detallados manteniendo compatibilidad con clientes legacy. Agregar `GET /progress/exercise/:exerciseId`.

## 2. Contexto técnico

- Prisma 6, PostgreSQL (Supabase).
- `ActivityLog` ya tiene FK a `User` y `Routine?`.
- `RoutineExercise` define lo planeado (`sets`, `reps`, `duration`).

## 3. Diseño propuesto

### 3.1 Schema Prisma

```prisma
model WorkoutSet {
  id                String   @id @default(uuid())
  activityLogId     String
  exerciseId        String
  routineExerciseId String?
  setNumber         Int
  weightKg          Float?
  reps              Int?
  durationSec       Int?
  rpe               Int?      // 1-10
  completed         Boolean   @default(true)
  notes             String?

  activityLog       ActivityLog     @relation(fields: [activityLogId], references: [id], onDelete: Cascade)
  exercise          Exercise        @relation(fields: [exerciseId],    references: [id])
  routineExercise   RoutineExercise? @relation(fields: [routineExerciseId], references: [id], onDelete: SetNull)

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([activityLogId])
  @@index([exerciseId])
  @@index([exerciseId, createdAt(sort: Desc)])
}

model ActivityLog {
  ...
  sets WorkoutSet[]
}

model Exercise {
  ...
  workoutSets WorkoutSet[]
}

model RoutineExercise {
  ...
  workoutSets WorkoutSet[]
}
```

### 3.2 Migración

```bash
npx prisma migrate dev --name add_workout_set
```

Nombre del archivo: `<timestamp>_add_workout_set/migration.sql`.

### 3.3 DTOs

```typescript
export class WorkoutSetDto {
  @IsInt() setNumber: number;
  @IsString() exerciseId: string;
  @IsOptional() @IsString() routineExerciseId?: string;
  @IsOptional() @IsNumber() weightKg?: number;
  @IsOptional() @IsInt() reps?: number;
  @IsOptional() @IsInt() durationSec?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) rpe?: number;
  @IsOptional() @IsBoolean() completed?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class LogActivityDto {
  @IsOptional() @IsString() routineId?: string;
  @IsOptional() @IsNumber() duration?: number;   // ⚠️ ahora opcional
  @IsOptional() @IsNumber() calories?: number;   // ⚠️ ahora opcional
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WorkoutSetDto)
  sets?: WorkoutSetDto[];
}
```

⚠️ **Breaking opcional**: `duration` y `calories` pasan de `@IsNotEmpty` a `@IsOptional`. Si se envían sets, podemos calcular duración (suma de descansos + tiempo activo) o dejarla en 0. Decisión inicial: **no calcular automáticamente** — el cliente puede enviar ambos o cualquiera.

Para evitar inserciones vacías, validar en el service: `if (!dto.duration && !dto.sets?.length) throw new BadRequestException()`.

### 3.4 Service

```typescript
async logActivity(userId: string, dto: LogActivityDto) {
  if (!dto.duration && !dto.sets?.length) {
    throw new BadRequestException('Either duration or sets are required');
  }

  return this.prisma.$transaction(async (tx) => {
    const log = await tx.activityLog.create({
      data: {
        userId,
        routineId: dto.routineId,
        duration: dto.duration ?? 0,
        calories: dto.calories ?? 0,
      },
    });

    if (dto.sets?.length) {
      await tx.workoutSet.createMany({
        data: dto.sets.map((s) => ({
          activityLogId: log.id,
          exerciseId: s.exerciseId,
          routineExerciseId: s.routineExerciseId,
          setNumber: s.setNumber,
          weightKg: s.weightKg,
          reps: s.reps,
          durationSec: s.durationSec,
          rpe: s.rpe,
          completed: s.completed ?? true,
          notes: s.notes,
        })),
      });
    }

    await this.updateStreak(userId, tx);  // mover updateStreak para aceptar tx
    return tx.activityLog.findUnique({ where: { id: log.id }, include: { sets: true } });
  });
}

async getExerciseHistory(userId: string, exerciseId: string, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const where: Prisma.WorkoutSetWhereInput = {
    exerciseId,
    activityLog: { userId },
  };
  const [data, total] = await this.prisma.$transaction([
    this.prisma.workoutSet.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: { activityLog: { select: { date: true, routineId: true } } },
    }),
    this.prisma.workoutSet.count({ where }),
  ]);
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}
```

### 3.5 Controller

```typescript
@Get('exercise/:id')
@ApiOperation({ summary: 'Get exercise history for the logged user' })
async getExerciseHistory(@Request() req, @Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
  return this.progressService.getExerciseHistory(req.user.id, id, page ? +page : 1, limit ? +limit : 50);
}
```

## 4. Alternativas consideradas

- **Modelar sets como JSON en `ActivityLog`**: rechazado. Pierde indexabilidad y dificulta consultas por ejercicio.
- **Crear modelo `WorkoutExercise` intermedio**: rechazado. Añade complejidad sin beneficio; `WorkoutSet` con FK directa a `Exercise` cubre los casos.
- **Calcular `duration` sumando `durationSec` de sets**: postergado a v2. Por ahora el cliente lo envía explícitamente.

## 5. Migraciones / compatibilidad

- Migración `add_workout_set`: agrega tabla, índices y relaciones.
- API legacy: clientes que envían `{ duration, calories }` siguen funcionando.
- Streak: `updateStreak` se llama dentro de la transacción; ajustar signatura para aceptar `tx`.

## 6. Seguridad

- Autorización via `req.user.id` en el JWT.
- `GET /progress/exercise/:id` valida que el set pertenezca al usuario logueado vía `activityLog.userId`.
- No exponer `notes` de otros usuarios (no hay endpoint que los exponga cross-user).

## 7. Performance

- `createMany` para sets es batch — eficiente.
- Índices `(exerciseId, createdAt desc)` aceleran historial por ejercicio.
- Tamaño esperado por usuario activo: ~5K sets/año. Con índices no es problema.

## 8. Testing

### Unit
- Insertar log con sets vs sin sets.
- `getExerciseHistory` filtra por `userId` correctamente.
- Borrar log → sets borrados en cascada (test directo Prisma).

### E2E
- `POST /progress/log` legacy y nuevo.
- `GET /progress/exercise/:id` ajeno → 200 con resultados vacíos (no encontró sets del usuario para ese ejercicio).

### Performance
- Test con 30 sets debe pasar en < 400 ms (CI no-prod).

## 9. Plan de rollout

| Fase | Acción |
|---|---|
| 1 | Merge schema + migración en una PR aislada. |
| 2 | Implementar endpoints en otra PR. |
| 3 | App móvil empieza a enviar sets cuando esté lista. |
| 4 | Después de 1 release con uso real, deprecar formato legacy (opcional). |

## 10. Open questions

- ¿Calcular `calories` server-side a partir de MET tables y `durationSec`? **No** para MVP — el cliente lo envía.
- ¿`updateStreak` debe contar logs sin sets como entrenamiento real? **Sí** por ahora; revisar si los sets son requeridos para "contar" como entrenamiento serio.
- ¿`setNumber` debería autocalcularse server-side basado en orden? Por simplicidad lo envía el cliente.
