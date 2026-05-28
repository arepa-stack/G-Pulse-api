# RFC F-14 — Catálogo extendido (admin: músculos / categorías)

| Campo | Valor |
|---|---|
| **Feature ID** | F-14 |
| **PRD asociado** | [`../prds/PF-14-admin-catalog-extended.md`](../prds/PF-14-admin-catalog-extended.md) |
| **Status** | Propuesto |
| **Esfuerzo** | S (1-1.5 días) |

## 1. TL;DR

Agregar 2 sub-recursos CRUD en `AdminController` reutilizando el patrón existente. Validación de referencias en `DELETE`.

## 2. Contexto técnico

- Modelos existentes: `Muscle { id, name, target?, primaryExercises[], secondaryExercises[] }`, `Category { id, name, exercises[] }`.

## 3. Diseño propuesto

### 3.1 DTOs

```typescript
export class CreateMuscleDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() target?: string;
}
export class UpdateMuscleDto extends PartialType(CreateMuscleDto) {}

export class CreateCategoryDto {
  @IsString() @IsNotEmpty() name: string;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
```

### 3.2 Endpoints (en AdminController)

```typescript
// MUSCLES
@Get('muscles') getMuscles() { return this.adminService.findAllMuscles(); }
@Post('muscles') createMuscle(@Body() d: CreateMuscleDto) { return this.adminService.createMuscle(d); }
@Patch('muscles/:id') updateMuscle(@Param('id') id: string, @Body() d: UpdateMuscleDto) {
  return this.adminService.updateMuscle(id, d);
}
@Delete('muscles/:id') deleteMuscle(@Param('id') id: string, @Query('force') force?: string) {
  return this.adminService.deleteMuscle(id, force === 'true');
}

// CATEGORIES
@Get('categories') getCategories() { return this.adminService.findAllCategories(); }
@Post('categories') createCategory(@Body() d: CreateCategoryDto) { return this.adminService.createCategory(d); }
@Patch('categories/:id') updateCategory(@Param('id') id: string, @Body() d: UpdateCategoryDto) {
  return this.adminService.updateCategory(id, d);
}
@Delete('categories/:id') deleteCategory(@Param('id') id: string, @Query('force') force?: string) {
  return this.adminService.deleteCategory(id, force === 'true');
}
```

### 3.3 Service

```typescript
async findAllMuscles() {
  return this.prisma.muscle.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { primaryExercises: true, secondaryExercises: true } } },
  });
}

async createMuscle(dto: CreateMuscleDto) {
  try {
    return await this.prisma.muscle.create({ data: dto });
  } catch (e: any) {
    if (e.code === 'P2002') throw new ConflictException('Name already exists');
    throw e;
  }
}

async updateMuscle(id: string, dto: UpdateMuscleDto) {
  const m = await this.prisma.muscle.findUnique({ where: { id } });
  if (!m) throw new NotFoundException();
  return this.prisma.muscle.update({ where: { id }, data: dto });
}

async deleteMuscle(id: string, force = false) {
  const m = await this.prisma.muscle.findUnique({
    where: { id },
    include: { _count: { select: { primaryExercises: true, secondaryExercises: true } } },
  });
  if (!m) throw new NotFoundException();
  const refs = m._count.primaryExercises + m._count.secondaryExercises;
  if (refs > 0 && !force) {
    throw new ConflictException({
      message: `Muscle is referenced by ${refs} exercises. Use ?force=true to disconnect and delete.`,
      references: refs,
    });
  }
  // Desconectar relaciones M:N antes de borrar
  await this.prisma.muscle.update({
    where: { id },
    data: { primaryExercises: { set: [] }, secondaryExercises: { set: [] } },
  });
  return this.prisma.muscle.delete({ where: { id } });
}

// Para categorías la lógica es análoga (con _count.exercises)
```

## 4. Alternativas consideradas

- **Permitir `DELETE` siempre, dejando ejercicios con `categoryId = null`**: viable. Por consistencia con la convención `force`, lo dejamos opt-in.

## 5. Migraciones / compatibilidad

- Ninguna.
- API aditiva.

## 6. Seguridad

- Restricción admin.
- Validaciones server-side.

## 7. Performance

- Catálogos pequeños (< 100 entradas) → trivial.

## 8. Testing

### Unit
- Crear duplicado → 409.
- Borrar referenciado sin `force` → 409.
- Borrar referenciado con `force` → desasocia y borra.

## 9. Plan de rollout

- 1 PR. Bajo riesgo.

## 10. Open questions

- ¿Mostrar conteo de ejercicios en el listado para UX admin? Sí (ya incluido en el ejemplo).
- ¿Endpoints públicos `GET /muscles`, `GET /categories` para que el cliente arme dropdowns? Útil; agregar como follow-up de bajo costo.
