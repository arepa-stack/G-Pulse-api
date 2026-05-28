# RFC F-03 — Feed público de rutinas

| Campo | Valor |
|---|---|
| **Feature ID** | F-03 |
| **PRD asociado** | [`../prds/PF-03-public-routines-feed.md`](../prds/PF-03-public-routines-feed.md) |
| **Status** | Propuesto |
| **Esfuerzo** | S (1 día) |

## 1. TL;DR

`GET /routines/public` paginado, con búsqueda y ordenamiento. Resuelto en `RoutinesService.findPublic`. Sin cambios en schema, solo posibles índices.

## 2. Contexto técnico

- `Routine.isPublic` ya existe.
- `Routine.likes` ya existe.
- Hoy no hay índices específicos para este patrón de consulta.

## 3. Diseño propuesto

### 3.1 DTO

```typescript
export class FindPublicRoutinesDto {
  @IsOptional() @IsNumberString() page?: string;
  @IsOptional() @IsNumberString() limit?: string;
  @IsOptional() @IsString()       search?: string;
  @IsOptional() @IsIn(['likes', 'recent']) sort?: 'likes' | 'recent';
}
```

### 3.2 Controller

```typescript
@Get('public')
@ApiOperation({ summary: 'Discover public routines from the community' })
async findPublic(@Query() query: FindPublicRoutinesDto) {
  return this.routinesService.findPublic(query);
}
```

> ⚠️ Cuidado con la **colisión de ruta** con `GET /routines/:id` (F-02). NestJS resuelve por orden de definición y `/public` debe declararse **antes** de `:id`, o usar prefijo `/discover/public`. Recomendado: declarar `findPublic` antes de `findOne(:id)`.

### 3.3 Service

```typescript
async findPublic(q: FindPublicRoutinesDto) {
  const take = Math.min(q.limit ? parseInt(q.limit) : 20, 50);
  const skip = q.page ? (parseInt(q.page) - 1) * take : 0;

  const where: Prisma.RoutineWhereInput = {
    isPublic: true,
    exercises: { some: {} }, // excluir rutinas vacías
    ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }),
  };

  const orderBy: Prisma.RoutineOrderByWithRelationInput =
    q.sort === 'likes' ? { likes: 'desc' } : { createdAt: 'desc' };

  const [data, total] = await this.prisma.$transaction([
    this.prisma.routine.findMany({
      where, skip, take, orderBy,
      select: {
        id: true,
        name: true,
        description: true,
        likes: true,
        createdAt: true,
        creator: { select: { name: true } },
        _count: { select: { exercises: true } },
      },
    }),
    this.prisma.routine.count({ where }),
  ]);

  return {
    data,
    meta: { total, page: q.page ? +q.page : 1, limit: take, totalPages: Math.ceil(total / take) },
  };
}
```

### 3.4 Índices recomendados (Prisma)

Si el feed crece > 1000 rutinas públicas, agregar:

```prisma
model Routine {
  ...
  @@index([isPublic, createdAt(sort: Desc)])
  @@index([isPublic, likes(sort: Desc)])
}
```

(Postgres acepta índices descendentes nativamente.)

## 4. Alternativas consideradas

- **Endpoint sin auth**: rechazado para mantener simetría con el resto y poder rastrear quién consulta.
- **Devolver `creatorId`**: rechazado por privacidad. Si en el futuro hay perfiles públicos, se agrega un `creator.publicId` o slug.

## 5. Migraciones / compatibilidad

- Ninguna obligatoria para MVP. Los índices son opcionales y se pueden agregar después.

## 6. Seguridad

- Filtra `select` para no leakear emails.
- Considerar rate limiting si el endpoint se expone públicamente sin auth (no aplica con `AuthGuard`).

## 7. Performance

- Con índice compuesto el query es O(log N) para ordering + paginación.
- `exercises: { some: {} }` introduce un join — aceptable, indexar `exerciseId` en `RoutineExercise` ya está.

## 8. Testing

### Unit
- `findPublic` solo devuelve `isPublic=true`.
- `?sort=likes` ordena correctamente.
- `?search` filtra case-insensitive.

### E2E
- Listar feed, paginar, buscar.

## 9. Plan de rollout

| Día | Acción |
|---|---|
| D0 | Endpoint a staging. Validar con datos de seed. |
| D1 | Producción. |
| Semana 2 | Agregar índices si el `EXPLAIN ANALYZE` muestra full scan. |

## 10. Open questions

- ¿Permitir filtrar por nivel del creador (`creator.level=BEGINNER`)? Útil pero opcional para MVP.
- ¿Limitar a usuarios PRO/EXPERT marcar rutinas como públicas? Decisión de producto.
