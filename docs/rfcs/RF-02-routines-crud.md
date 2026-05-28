# RFC F-02 — Gestión de rutinas del usuario (CRUD)

| Campo | Valor |
|---|---|
| **Feature ID** | F-02 |
| **PRD asociado** | [`../prds/PF-02-routines-crud.md`](../prds/PF-02-routines-crud.md) |
| **Status** | Propuesto |
| **Esfuerzo** | M (2-3 días) |

## 1. TL;DR

Exponer 4 endpoints CRUD en `RoutinesController` con autorización por propietario y soporte opcional para rutinas públicas en `GET /routines/:id`.

## 2. Contexto técnico

- `Routine` ya tiene `creatorId` (FK → User) e `isPublic` (boolean).
- `RoutineExercise` tiene relación con `Routine` y `Exercise` con `order`.
- `UserFavorite` y `ActivityLog` referencian `Routine`. En la migración actual `ActivityLog.routineId` es `String?` pero no se especifica `onDelete: SetNull` explícitamente — verificar.

## 3. Diseño propuesto

### 3.1 Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/routines` | JWT | Lista paginada de rutinas del usuario logueado. |
| `GET` | `/routines/:id` | JWT | Detalle de rutina (propia o pública). |
| `PATCH` | `/routines/:id` | JWT | Actualiza rutina propia. |
| `DELETE` | `/routines/:id` | JWT | Elimina rutina propia. |

### 3.2 DTOs

#### `FindAllRoutinesDto` (query)
```typescript
export class FindAllRoutinesDto {
  @IsOptional() @IsNumberString() page?: string;
  @IsOptional() @IsNumberString() limit?: string;
  @IsOptional() @IsString()       search?: string;
}
```

#### `UpdateRoutineDto`
```typescript
export class UpdateRoutineDto {
  @IsOptional() @IsString()        name?: string;
  @IsOptional() @IsString()        description?: string;
  @IsOptional() @IsBoolean()       isPublic?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RoutineExerciseDto)
  exercises?: RoutineExerciseDto[];
}
```

(`RoutineExerciseDto` ya existe en `create-routine.dto.ts` — extraerlo a un archivo compartido).

### 3.3 Controller

```typescript
@ApiTags('routines')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('routines')
export class RoutinesController {
  constructor(private routinesService: RoutinesService) {}

  @Get()
  async findAll(@Request() req, @Query() query: FindAllRoutinesDto) {
    return this.routinesService.findAllForUser(req.user.id, query);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.routinesService.findOneForUser(req.user.id, id);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateRoutineDto) {
    return this.routinesService.updateForUser(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req, @Param('id') id: string) {
    return this.routinesService.removeForUser(req.user.id, id);
  }

  // POST ya existe (cubierto por F-01)
}
```

### 3.4 Service — métodos nuevos

```typescript
async findAllForUser(userId: string, q: FindAllRoutinesDto) {
  const take = q.limit ? parseInt(q.limit) : 20;
  const skip = q.page ? (parseInt(q.page) - 1) * take : 0;
  const where: Prisma.RoutineWhereInput = {
    creatorId: userId,
    ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }),
  };
  const [data, total] = await this.prisma.$transaction([
    this.prisma.routine.findMany({
      where, skip, take, orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { exercises: true } } },
    }),
    this.prisma.routine.count({ where }),
  ]);
  return { data, meta: { total, page: q.page ? +q.page : 1, limit: take, totalPages: Math.ceil(total / take) } };
}

async findOneForUser(userId: string, id: string) {
  const routine = await this.prisma.routine.findUnique({
    where: { id },
    include: { exercises: { include: { exercise: { include: { images: true } } }, orderBy: { order: 'asc' } } },
  });
  if (!routine) throw new NotFoundException();
  if (routine.creatorId !== userId && !routine.isPublic) throw new ForbiddenException();
  return routine;
}

async updateForUser(userId: string, id: string, dto: UpdateRoutineDto) {
  const owned = await this.prisma.routine.findFirst({ where: { id, creatorId: userId }, select: { id: true } });
  if (!owned) throw new ForbiddenException();

  return this.prisma.$transaction(async (tx) => {
    if (dto.exercises) {
      await tx.routineExercise.deleteMany({ where: { routineId: id } });
      for (let i = 0; i < dto.exercises.length; i++) {
        const ex = dto.exercises[i];
        const exercise = await tx.exercise.findFirst({ where: { name: ex.exerciseName } });
        if (!exercise) continue; // o crear placeholder como en POST
        await tx.routineExercise.create({
          data: { routineId: id, exerciseId: exercise.id, order: i + 1, sets: ex.sets ?? 3, reps: ex.reps ?? 10, duration: ex.duration ? +ex.duration : null },
        });
      }
    }
    return tx.routine.update({
      where: { id },
      data: { name: dto.name, description: dto.description, isPublic: dto.isPublic },
      include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
    });
  });
}

async removeForUser(userId: string, id: string) {
  const owned = await this.prisma.routine.findFirst({ where: { id, creatorId: userId }, select: { id: true } });
  if (!owned) throw new ForbiddenException();
  await this.prisma.$transaction([
    this.prisma.routineExercise.deleteMany({ where: { routineId: id } }),
    this.prisma.userFavorite.deleteMany({ where: { routineId: id } }),
    this.prisma.routine.delete({ where: { id } }),
  ]);
}
```

### 3.5 Cambio en schema Prisma (verificar)

Confirmar que `ActivityLog.routine` tenga `onDelete: SetNull` (Prisma por defecto **no** lo aplica si no se declara explícitamente):

```prisma
model ActivityLog {
  ...
  routineId String?
  routine   Routine? @relation(fields: [routineId], references: [id], onDelete: SetNull)
}
```

Si no está configurado, requerirá una migración menor.

## 4. Alternativas consideradas

- **Soft delete** (campo `deletedAt`): rechazado para MVP — añade complejidad sin beneficio claro a esta escala.
- **`PUT` en vez de `PATCH`**: rechazado — `PATCH` permite actualizaciones parciales, lo cual es estándar REST.
- **Eliminar también ejercicios huérfanos generados por IA**: rechazado por ahora — esos ejercicios pueden estar en uso por otras rutinas.

## 5. Migraciones / compatibilidad

- Migración Prisma para `ActivityLog.routine onDelete: SetNull` (si no estaba). Nombre sugerido: `set_null_on_routine_delete`.
- API contract: **aditivo** — sin breaking changes para `POST /routines`.

## 6. Seguridad

- Autorización: chequeo de propietario antes de cualquier mutación.
- Información leaked: `404` vs `403` — usar `404` para no revelar existencia de rutinas ajenas (`Promise.all` y combinar). En MVP es aceptable diferenciar para mejor UX; revisar en hardening.

## 7. Performance

- `findMany` incluye `_count.exercises` (barato). Si se evoluciona a un feed con muchos elementos, indexar `creatorId`.
- `updateForUser` con reemplazo total de ejercicios: O(N) ejercicios — aceptable para rutinas típicas (≤30 ejercicios).

## 8. Testing

### Unit (`routines.service.spec.ts`)
- `findAllForUser` filtra por `creatorId`.
- `findOneForUser` con rutina ajena no pública → `ForbiddenException`.
- `findOneForUser` con rutina pública ajena → ok.
- `removeForUser` borra en cascada correctamente.

### E2E (`test/`)
- 4 endpoints con/sin token + casos 403/404.

## 9. Plan de rollout

| Día | Acción |
|---|---|
| D0 | Migración + endpoints en staging. |
| D1 | Pruebas con datos seed. |
| D2 | Deploy a producción detrás de feature-flag (si se quiere extra cautela). |

## 10. Open questions

- ¿`PATCH /routines/:id` con `exercises = []` debe vaciar la rutina o ignorar el campo? **Propuesta**: vaciar (es explícito).
- ¿Permitir transferir creador (`creatorId`)? **No** para MVP.
- ¿Mostrar al usuario las rutinas "favoritas" en `GET /routines`? **No** — eso es F-06.
