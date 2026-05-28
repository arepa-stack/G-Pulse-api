# RFC F-11 — Goals / Objetivos

| Campo | Valor |
|---|---|
| **Feature ID** | F-11 |
| **PRD asociado** | [`../prds/PF-11-goals.md`](../prds/PF-11-goals.md) |
| **Status** | Propuesto |
| **Esfuerzo** | M (3 días) |

## 1. TL;DR

Módulo `GoalsModule` con 4 tipos soportados en v1, cálculo de progreso server-side y endpoint dedicado.

## 2. Contexto técnico

- Depende de F-04 (logs/sets), F-05 (PRs), F-09 (mediciones).

## 3. Diseño propuesto

### 3.1 Schema

```prisma
enum GoalType {
  WORKOUTS_PER_WEEK
  WEIGHT_LOSS_KG
  WEIGHT_GAIN_KG
  EXERCISE_PR_KG
}

enum GoalStatus {
  ACTIVE
  COMPLETED
  CANCELED
  EXPIRED
}

model Goal {
  id          String     @id @default(uuid())
  userId      String
  type        GoalType
  target      Float
  baseline    Float?     // requerido para WEIGHT_LOSS/GAIN
  exerciseId  String?    // requerido para EXERCISE_PR_KG
  deadline    DateTime?
  status      GoalStatus @default(ACTIVE)
  completedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  user        User       @relation(fields: [userId],     references: [id], onDelete: Cascade)
  exercise    Exercise?  @relation(fields: [exerciseId], references: [id])

  @@index([userId, status])
}

model User { ...; goals Goal[] }
model Exercise { ...; goals Goal[] }
```

Migración: `add_goals`.

### 3.2 DTOs

```typescript
export class CreateGoalDto {
  @IsEnum(GoalType) type: GoalType;
  @IsNumber() @Min(0.1) target: number;
  @IsOptional() @IsNumber() baseline?: number;
  @IsOptional() @IsString() exerciseId?: string;
  @IsOptional() @IsDateString() deadline?: string;
}
```

### 3.3 Controller

```typescript
@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('goals')
export class GoalsController {
  constructor(private readonly service: GoalsService) {}

  @Post() create(@Request() req, @Body() dto: CreateGoalDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get() findAll(@Request() req) { return this.service.findAll(req.user.id); }

  @Get('me/progress') progress(@Request() req) {
    return this.service.progressForUser(req.user.id);
  }

  @Get(':id') findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.id, id);
  }

  @Patch(':id') update(@Request() req, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(req.user.id, id);
  }
}
```

### 3.4 Service — cálculo de progreso (clave)

```typescript
async progressForUser(userId: string) {
  const goals = await this.prisma.goal.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { exercise: { select: { id: true, name: true } } },
  });

  const result = [];
  for (const g of goals) {
    let current = 0;
    let percent = 0;

    if (g.type === 'WORKOUTS_PER_WEEK') {
      const monday = startOfWeek(new Date());
      const sunday = endOfWeek(new Date());
      const count = await this.prisma.activityLog.count({
        where: { userId, date: { gte: monday, lte: sunday } },
      });
      current = count;
      percent = Math.min(100, (count / g.target) * 100);
    }

    if (g.type === 'WEIGHT_LOSS_KG' || g.type === 'WEIGHT_GAIN_KG') {
      const latest = await this.prisma.bodyMeasurement.findFirst({
        where: { userId, weightKg: { not: null } },
        orderBy: { date: 'desc' },
      });
      if (latest?.weightKg && g.baseline) {
        const delta = g.type === 'WEIGHT_LOSS_KG'
          ? g.baseline - latest.weightKg
          : latest.weightKg - g.baseline;
        current = delta;
        percent = Math.min(100, Math.max(0, (delta / g.target) * 100));
      }
    }

    if (g.type === 'EXERCISE_PR_KG' && g.exerciseId) {
      // Reutilizar lógica de F-05: traer el bestOneRm del ejercicio
      const prs = await this.progressService.getPersonalRecords(userId, g.exerciseId);
      const pr = prs[0]?.bestOneRm ?? 0;
      current = pr;
      percent = Math.min(100, (pr / g.target) * 100);
    }

    // Status transitions
    let newStatus = g.status;
    if (percent >= 100) newStatus = 'COMPLETED';
    else if (g.deadline && g.deadline < new Date()) newStatus = 'EXPIRED';

    if (newStatus !== g.status) {
      await this.prisma.goal.update({
        where: { id: g.id },
        data: { status: newStatus, completedAt: newStatus === 'COMPLETED' ? new Date() : null },
      });
    }

    result.push({ goal: g, current, percent, status: newStatus });
  }

  return result;
}
```

### 3.5 Validaciones especiales

- `EXERCISE_PR_KG` sin `exerciseId` → 400.
- `WEIGHT_LOSS_KG` / `WEIGHT_GAIN_KG` sin `baseline`: auto-completar con el último peso del usuario; si no hay → 400.

## 4. Alternativas consideradas

- **Goals "open-ended" sin tipo**: rechazado por dificultad de medir progreso.
- **Calcular `status` por cron**: alternativa válida; lo hacemos en demand para MVP, podemos migrar a cron si la query crece.

## 5. Migraciones / compatibilidad

- Migración `add_goals`.
- API aditiva.

## 6. Seguridad

- Autorización por `userId`.

## 7. Performance

- `progressForUser` ejecuta N+1 queries (uno por goal activo); aceptable con < 5 goals activos por usuario. Si crece, batchear con `Promise.all`.

## 8. Testing

### Unit
- Crear goal de cada tipo.
- Cálculo de progreso para cada tipo con fixtures.
- Transición a EXPIRED si deadline pasada.

## 9. Plan de rollout

- 1 PR con migración + módulo. App móvil añade la UI iterativamente.

## 10. Open questions

- ¿Limitar a 3 goals activos por usuario (o por tipo)? Útil para evitar ruido visual. Decisión de producto.
- ¿Permitir editar `target` o `deadline` después de creado? Sí (`PATCH`), pero loguear que fue ajustado.
