# RFC F-07 — Likes en rutinas

| Campo | Valor |
|---|---|
| **Feature ID** | F-07 |
| **PRD asociado** | [`../prds/PF-07-likes.md`](../prds/PF-07-likes.md) |
| **Status** | Propuesto |
| **Esfuerzo** | S (1 día) |

## 1. TL;DR

Modelo nuevo `RoutineLike(userId, routineId)` con PK compuesta + 2 endpoints idempotentes. El contador `Routine.likes` se mantiene atómico vía transacción.

## 2. Contexto técnico

- `Routine.likes` (Int @default(0)) ya existe en el schema.
- Patrón análogo a `UserFavorite`.

## 3. Diseño propuesto

### 3.1 Schema

```prisma
model RoutineLike {
  userId    String
  routineId String
  createdAt DateTime @default(now())

  user      User    @relation(fields: [userId],    references: [id], onDelete: Cascade)
  routine   Routine @relation(fields: [routineId], references: [id], onDelete: Cascade)

  @@id([userId, routineId])
  @@index([routineId])
}

model Routine {
  ...
  likedBy RoutineLike[]
}

model User {
  ...
  routineLikes RoutineLike[]
}
```

Migración: `add_routine_like`.

### 3.2 Endpoints

```typescript
@Post(':id/like')
@HttpCode(HttpStatus.NO_CONTENT)
async like(@Request() req, @Param('id') routineId: string) {
  return this.routinesService.like(req.user.id, routineId);
}

@Delete(':id/like')
@HttpCode(HttpStatus.NO_CONTENT)
async unlike(@Request() req, @Param('id') routineId: string) {
  return this.routinesService.unlike(req.user.id, routineId);
}
```

### 3.3 Service

```typescript
async like(userId: string, routineId: string) {
  const routine = await this.prisma.routine.findUnique({ where: { id: routineId }, select: { isPublic: true } });
  if (!routine) throw new NotFoundException();
  if (!routine.isPublic) throw new ForbiddenException('Only public routines can be liked');

  await this.prisma.$transaction(async (tx) => {
    const result = await tx.routineLike.upsert({
      where: { userId_routineId: { userId, routineId } },
      create: { userId, routineId },
      update: {},
    });
    // Solo incrementar si fue create (no update).
    // Truco: usar createMany con skipDuplicates en vez de upsert para detectarlo.
  });
}
```

> **Mejor implementación** (detecta si fue una inserción nueva):

```typescript
async like(userId: string, routineId: string) {
  const routine = await this.prisma.routine.findUnique({ where: { id: routineId }, select: { isPublic: true } });
  if (!routine) throw new NotFoundException();
  if (!routine.isPublic) throw new ForbiddenException();

  await this.prisma.$transaction(async (tx) => {
    const r = await tx.routineLike.createMany({
      data: [{ userId, routineId }],
      skipDuplicates: true,
    });
    if (r.count === 1) {
      await tx.routine.update({ where: { id: routineId }, data: { likes: { increment: 1 } } });
    }
  });
}

async unlike(userId: string, routineId: string) {
  await this.prisma.$transaction(async (tx) => {
    const r = await tx.routineLike.deleteMany({ where: { userId, routineId } });
    if (r.count === 1) {
      await tx.routine.update({
        where: { id: routineId },
        data: { likes: { decrement: 1 } },
      });
      // Guard contra negatives (defensivo):
      await tx.routine.updateMany({ where: { id: routineId, likes: { lt: 0 } }, data: { likes: 0 } });
    }
  });
}
```

### 3.4 Sincronización en `DELETE /routines/:id`

El borrado de rutina ya borra los likes vía `onDelete: Cascade` en el FK. No hay que tocar la lógica de F-02.

## 4. Alternativas consideradas

- **Mantener solo `Routine.likes` sin tabla de relación**: rechazado — un usuario podría dar like múltiples veces y no se podría desmarcar correctamente.
- **Toggle único `POST /routines/:id/toggle-like`**: rechazado — `POST/DELETE` es más REST-estándar y permite UI con estado claro.
- **`Pub/Sub` o event sourcing para el contador**: overkill.

## 5. Migraciones / compatibilidad

- Migración `add_routine_like`.
- Sin breaking changes en API existente.

## 6. Seguridad

- Validación `isPublic=true` antes de aceptar like.

## 7. Performance

- PK compuesta indexada → upsert / delete eficiente.
- Contador desnormalizado evita `COUNT()` en cada lectura del feed.

## 8. Testing

### Unit
- 1ra llamada `like` incrementa, 2da no incrementa.
- `unlike` después de no-like no decrementa.
- Like sobre rutina privada → 403.

### E2E
- Like + listar feed con `?sort=likes` → orden correcto.

## 9. Plan de rollout

- Una PR. Migración + service + tests.

## 10. Open questions

- ¿Permitir like a la propia rutina? Default **sí**; cambiar si el equipo lo prefiere bloqueado.
- ¿Mostrar al cliente si ya dio like ("liked: true")? Conviene exponerlo en el endpoint de detalle o en el feed. **Propuesta**: agregar `likedByMe` calculado en F-02/F-03 vía sub-query — fuera de este RFC.
