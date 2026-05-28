# RFC F-15 — Hardening admin (DTO para `PATCH /admin/users/:id`)

| Campo | Valor |
|---|---|
| **Feature ID** | F-15 |
| **PRD asociado** | [`../prds/PF-15-admin-hardening.md`](../prds/PF-15-admin-hardening.md) |
| **Status** | Propuesto |
| **Esfuerzo** | XS (1-2 horas) |

## 1. TL;DR

Crear `UpdateUserAdminDto` con `class-validator` y reemplazar el tipo del body del endpoint admin.

## 2. Contexto técnico

- `ValidationPipe` global ya tiene `whitelist: true`, `forbidNonWhitelisted: true` y `transform: true` (`src/main.ts`). Esto significa que **un DTO formal será suficiente** para rechazar todo lo extra.

## 3. Diseño propuesto

### 3.1 DTO

```typescript
// src/admin/dto/update-user-admin.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role, SubscriptionPlan, UserLevel } from '@prisma/client';

export class UpdateUserAdminDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: UserLevel })        @IsOptional() @IsEnum(UserLevel)        level?: UserLevel;
  @ApiPropertyOptional({ enum: SubscriptionPlan }) @IsOptional() @IsEnum(SubscriptionPlan) plan?: SubscriptionPlan;
  @ApiPropertyOptional({ enum: Role })             @IsOptional() @IsEnum(Role)             role?: Role;
}
```

### 3.2 Controller

```typescript
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';

@Patch('users/:id')
@ApiOperation({ summary: 'Update a user (e.g. change plan or role)' })
async updateUser(@Param('id') id: string, @Body() dto: UpdateUserAdminDto) {
  return this.adminService.updateUser(id, dto);
}
```

### 3.3 Service

Sin cambios — la firma `Partial<Pick<...>>` actual sigue compatible con el DTO porque los campos son los mismos.

## 4. Alternativas consideradas

- **Mantener tipo Prisma sin validación**: rechazado por la razón principal de seguridad.
- **Usar `PartialType(Pick(UserCreateInput, [...]))`**: posible pero requiere reflejar shape de Prisma que es ruidoso. DTO explícito es más limpio.

## 5. Migraciones / compatibilidad

- Sin migraciones.
- **Posible breaking** si un cliente legítimo enviaba campos no listados. Auditar logs de `PATCH /admin/users/:id` para confirmar.

## 6. Seguridad

- Antes: cualquier campo de la `User` table podía actualizarse.
- Después: solo `name`, `level`, `plan`, `role`.

## 7. Performance

- Cero impacto.

## 8. Testing

### Unit
- Body `{ aiPromptCount: 0 }` → 400 (test e2e más natural).
- Body `{ role: 'INVALID' }` → 400.
- Body `{ name: 'foo' }` → 200.

## 9. Plan de rollout

- 1 PR pequeña.

## 10. Open questions

- ¿Permitir cambiar `email`? Decisión de producto. **No** por default.
- ¿Permitir resetear `trainingStreak` o `aiPromptCount`? Útil para soporte, pero requiere endpoint separado (auditado).
