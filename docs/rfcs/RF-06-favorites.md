# RFC F-06 — Favoritos

| Campo | Valor |
|---|---|
| **Feature ID** | F-06 |
| **PRD asociado** | [`../prds/PF-06-favorites.md`](../prds/PF-06-favorites.md) |
| **Status** | Propuesto |
| **Esfuerzo** | S (1 día) |

## 1. TL;DR

3 endpoints sobre el modelo `UserFavorite` (que ya existe). Idempotente vía Prisma `upsert` / `deleteMany`.

## 2. Contexto técnico

Schema actual:
```prisma
model UserFavorite {
  userId    String
  routineId String
  createdAt DateTime @default(now())
  user      User    @relation(fields: [userId],    references: [id])
  routine   Routine @relation(fields: [routineId], references: [id])

  @@id([userId, routineId])
}
```

## 3. Diseño propuesto

### 3.1 Endpoints

```typescript
// en RoutinesController (o en un FavoritesController dedicado)

@Post(':id/favorite')
@HttpCode(HttpStatus.NO_CONTENT)
async favorite(@Request() req, @Param('id') routineId: string) {
  return this.routinesService.favorite(req.user.id, routineId);
}

@Delete(':id/favorite')
@HttpCode(HttpStatus.NO_CONTENT)
async unfavorite(@Request() req, @Param('id') routineId: string) {
  return this.routinesService.unfavorite(req.user.id, routineId);
}

// en UsersController
@Get('me/favorites')
async getFavorites(@Request() req, @Query('page') page?: string, @Query('limit') limit?: string) {
  return this.usersService.getFavorites(req.user.id, page ? +page : 1, limit ? +limit : 20);
}
```

### 3.2 Service (`RoutinesService`)

```typescript
async favorite(userId: string, routineId: string) {
  const routine = await this.prisma.routine.findUnique({ where: { id: routineId }, select: { creatorId: true, isPublic: true } });
  if (!routine) throw new NotFoundException();
  if (routine.creatorId !== userId && !routine.isPublic) throw new ForbiddenException();

  await this.prisma.userFavorite.upsert({
    where: { userId_routineId: { userId, routineId } },
    create: { userId, routineId },
    update: {},  // idempotente
  });
}

async unfavorite(userId: string, routineId: string) {
  await this.prisma.userFavorite.deleteMany({ where: { userId, routineId } });
}
```

### 3.3 Service (`UsersService`)

```typescript
async getFavorites(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [data, total] = await this.prisma.$transaction([
    this.prisma.userFavorite.findMany({
      where: { userId },
      skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        routine: {
          select: {
            id: true, name: true, description: true, likes: true, isPublic: true,
            creator: { select: { name: true } },
            _count: { select: { exercises: true } },
          },
        },
      },
    }),
    this.prisma.userFavorite.count({ where: { userId } }),
  ]);
  return {
    data: data.map((f) => ({ ...f.routine, favoritedAt: f.createdAt })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
```

## 4. Alternativas consideradas

- **No filtrar por `isPublic` en `favorite`** (permitir favoritar cualquier rutina): rechazado por consistencia con F-02 (no se puede acceder al detalle).
- **Endpoint `GET /routines/:id/is-favorite`**: redundante; el cliente puede inferirlo del listado.

## 5. Migraciones / compatibilidad

- Ninguna migración (modelo existente).
- API aditiva.

## 6. Seguridad

- Validación de propiedad o `isPublic` antes de marcar.
- `deleteMany` no falla si no existe el favorito.

## 7. Performance

- PK compuesta `(userId, routineId)` → upsert O(log N) sobre índice.

## 8. Testing

- Marcar/desmarcar idempotente.
- Marcar privada ajena → 403.
- `GET /users/me/favorites` paginado.

## 9. Plan de rollout

- Trivial. Una sola PR.

## 10. Open questions

- ¿Subir el contador `Routine.likes` al favoritar? **No** — los likes son una feature aparte (F-07).
