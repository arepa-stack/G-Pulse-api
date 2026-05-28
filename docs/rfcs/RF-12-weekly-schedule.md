# RFC F-12 — Calendario semanal de rutinas

| Campo | Valor |
|---|---|
| **Feature ID** | F-12 |
| **PRD asociado** | [`../prds/PF-12-weekly-schedule.md`](../prds/PF-12-weekly-schedule.md) |
| **Status** | Propuesto |
| **Esfuerzo** | S (1 día) |

## 1. TL;DR

Modelo simple `RoutineSchedule(userId, dayOfWeek)` con PK compuesta + 3 endpoints. `GET /routines/today` resuelve `dayOfWeek = new Date().getDay()`.

## 2. Contexto técnico

- Estándar JS `Date.getDay()`: 0=Domingo, 6=Sábado.
- Usar zona horaria del servidor por simplicidad; documentar.

## 3. Diseño propuesto

### 3.1 Schema

```prisma
model RoutineSchedule {
  userId    String
  dayOfWeek Int       // 0..6 ; 0=Sun, 6=Sat
  routineId String
  enabled   Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  user      User      @relation(fields: [userId],    references: [id], onDelete: Cascade)
  routine   Routine   @relation(fields: [routineId], references: [id], onDelete: Cascade)

  @@id([userId, dayOfWeek])
  @@index([routineId])
}

model User { ...; schedule RoutineSchedule[] }
model Routine { ...; scheduledFor RoutineSchedule[] }
```

Migración: `add_routine_schedule`.

### 3.2 Endpoints

```typescript
@ApiTags('schedule')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Post()
  async upsert(@Request() req, @Body() dto: UpsertScheduleDto) {
    return this.service.upsert(req.user.id, dto);
  }

  @Get()
  async list(@Request() req) {
    return this.service.list(req.user.id);
  }

  @Delete(':dayOfWeek')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req, @Param('dayOfWeek', ParseIntPipe) day: number) {
    return this.service.remove(req.user.id, day);
  }
}

// Endpoint atajo dentro de RoutinesController
@Get('today')
async getToday(@Request() req) {
  return this.scheduleService.getToday(req.user.id);
}
```

### 3.3 DTO

```typescript
export class UpsertScheduleDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @IsString() routineId: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
```

### 3.4 Service

```typescript
async upsert(userId: string, dto: UpsertScheduleDto) {
  // Verificar que el usuario puede usar esa rutina (propia o pública)
  const r = await this.prisma.routine.findUnique({
    where: { id: dto.routineId },
    select: { creatorId: true, isPublic: true },
  });
  if (!r) throw new NotFoundException();
  if (r.creatorId !== userId && !r.isPublic) throw new ForbiddenException();

  return this.prisma.routineSchedule.upsert({
    where: { userId_dayOfWeek: { userId, dayOfWeek: dto.dayOfWeek } },
    create: { userId, dayOfWeek: dto.dayOfWeek, routineId: dto.routineId, enabled: dto.enabled ?? true },
    update: { routineId: dto.routineId, enabled: dto.enabled ?? true },
  });
}

async list(userId: string) {
  const rows = await this.prisma.routineSchedule.findMany({
    where: { userId },
    include: { routine: { select: { id: true, name: true, _count: { select: { exercises: true } } } } },
  });
  const byDay: Array<{ dayOfWeek: number; routine: any | null; enabled: boolean }> = [];
  for (let d = 0; d <= 6; d++) {
    const row = rows.find((r) => r.dayOfWeek === d);
    byDay.push({ dayOfWeek: d, routine: row?.routine ?? null, enabled: row?.enabled ?? false });
  }
  return byDay;
}

async remove(userId: string, day: number) {
  await this.prisma.routineSchedule.deleteMany({ where: { userId, dayOfWeek: day } });
}

async getToday(userId: string) {
  const day = new Date().getDay();
  const row = await this.prisma.routineSchedule.findUnique({
    where: { userId_dayOfWeek: { userId, dayOfWeek: day } },
    include: {
      routine: {
        include: { exercises: { include: { exercise: { include: { images: true } } }, orderBy: { order: 'asc' } } },
      },
    },
  });
  return row?.enabled ? row.routine : null;
}
```

## 4. Alternativas consideradas

- **Modelo con fecha exacta (`scheduledDate`)**: permite calendarios dinámicos pero abuso de complejidad para MVP. Patrón "día de la semana" es estándar para splits.
- **Mover `dayOfWeek` a `RoutineExercise`**: rechazado — los ejercicios no necesitan calendarización, las rutinas sí.

## 5. Migraciones / compatibilidad

- Migración `add_routine_schedule`.
- Sin breaking.

## 6. Seguridad

- Verificación de acceso a rutina al asignar.

## 7. Performance

- 7 filas máx por usuario → trivial.

## 8. Testing

### Unit
- Upsert reemplaza.
- `getToday` con sin entry → null.
- Asignar rutina privada ajena → 403.

## 9. Plan de rollout

- 1 PR. Mostrar el calendario en cliente como home opcional.

## 10. Open questions

- ¿Manejar zonas horarias por usuario? Para MVP server-time. Documentar.
- ¿Permitir múltiples rutinas por día (mañana/tarde)? **No** para MVP — un día, una rutina.
