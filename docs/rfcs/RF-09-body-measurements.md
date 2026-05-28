# RFC F-09 — Mediciones corporales

| Campo | Valor |
|---|---|
| **Feature ID** | F-09 |
| **PRD asociado** | [`../prds/PF-09-body-measurements.md`](../prds/PF-09-body-measurements.md) |
| **Status** | Propuesto |
| **Esfuerzo** | M (2 días) |

## 1. TL;DR

Módulo nuevo `MeasurementsModule` con 4 endpoints, un modelo Prisma sencillo y un DTO con validación de rangos.

## 2. Contexto técnico

- No hay módulo equivalente. Nace nuevo.

## 3. Diseño propuesto

### 3.1 Schema

```prisma
model BodyMeasurement {
  id          String   @id @default(uuid())
  userId      String
  date        DateTime @default(now())
  weightKg    Float?
  bodyFatPct  Float?
  waistCm     Float?
  chestCm     Float?
  armCm       Float?
  legCm       Float?
  hipCm       Float?
  notes       String?

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, date(sort: Desc)])
}

model User {
  ...
  measurements BodyMeasurement[]
}
```

Migración: `add_body_measurement`.

### 3.2 DTOs

```typescript
export class CreateMeasurementDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsNumber() @Min(20)  @Max(300) weightKg?: number;
  @IsOptional() @IsNumber() @Min(3)   @Max(60)  bodyFatPct?: number;
  @IsOptional() @IsNumber() @Min(30)  @Max(200) waistCm?: number;
  @IsOptional() @IsNumber() @Min(50)  @Max(200) chestCm?: number;
  @IsOptional() @IsNumber() @Min(15)  @Max(100) armCm?: number;
  @IsOptional() @IsNumber() @Min(30)  @Max(120) legCm?: number;
  @IsOptional() @IsNumber() @Min(50)  @Max(200) hipCm?: number;
  @IsOptional() @IsString() notes?: string;
}

export class FindMeasurementsDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsNumberString() page?: string;
  @IsOptional() @IsNumberString() limit?: string;
}
```

### 3.3 Controller

```typescript
@ApiTags('measurements')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly service: MeasurementsService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateMeasurementDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req, @Query() q: FindMeasurementsDto) {
    return this.service.findAll(req.user.id, q);
  }

  @Get('latest')
  latest(@Request() req) {
    return this.service.latest(req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(req.user.id, id);
  }
}
```

### 3.4 Service

```typescript
async create(userId: string, dto: CreateMeasurementDto) {
  const hasValue = ['weightKg','bodyFatPct','waistCm','chestCm','armCm','legCm','hipCm']
    .some((k) => dto[k as keyof CreateMeasurementDto] !== undefined);
  if (!hasValue) throw new BadRequestException('Provide at least one metric');

  return this.prisma.bodyMeasurement.create({
    data: { userId, ...dto, date: dto.date ? new Date(dto.date) : undefined },
  });
}

async findAll(userId: string, q: FindMeasurementsDto) {
  const take = q.limit ? Math.min(+q.limit, 100) : 30;
  const skip = q.page ? (+q.page - 1) * take : 0;
  const where: Prisma.BodyMeasurementWhereInput = {
    userId,
    ...(q.from && { date: { gte: new Date(q.from) } }),
    ...(q.to   && { date: { ...((q.from && { gte: new Date(q.from) }) || {}), lte: new Date(q.to) } }),
  };
  const [data, total] = await this.prisma.$transaction([
    this.prisma.bodyMeasurement.findMany({ where, skip, take, orderBy: { date: 'desc' } }),
    this.prisma.bodyMeasurement.count({ where }),
  ]);
  return { data, meta: { total, page: q.page ? +q.page : 1, limit: take, totalPages: Math.ceil(total / take) } };
}

async latest(userId: string) {
  // Para cada métrica devolver el último valor no-null
  const fields = ['weightKg','bodyFatPct','waistCm','chestCm','armCm','legCm','hipCm'] as const;
  const all = await this.prisma.bodyMeasurement.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 100,  // suficiente para encontrar el último de cada métrica
  });
  const result: Record<string, { value: number; date: Date } | null> = {};
  for (const f of fields) {
    const found = all.find((m) => m[f] !== null && m[f] !== undefined);
    result[f] = found ? { value: found[f] as number, date: found.date } : null;
  }
  return result;
}

async remove(userId: string, id: string) {
  const m = await this.prisma.bodyMeasurement.findFirst({ where: { id, userId } });
  if (!m) throw new ForbiddenException();
  await this.prisma.bodyMeasurement.delete({ where: { id } });
}
```

## 4. Alternativas consideradas

- **Una columna `metricType` + `metricValue` por fila**: rechazado por complejidad de queries. El modelo "ancho con muchos campos opcionales" es más simple para esta escala.
- **JSON `extras` para futuras métricas**: postergado a si surge necesidad.

## 5. Migraciones / compatibilidad

- Migración `add_body_measurement`.
- API aditiva.

## 6. Seguridad

- Autorización por `userId`.
- Validación de rangos para evitar valores absurdos.

## 7. Performance

- Índice `(userId, date desc)` cubre la query principal.

## 8. Testing

### Unit
- `create` sin métrica → 400.
- `latest` con varias filas devuelve el último de cada campo.
- `findAll` con rango filtra.

### E2E
- CRUD básico.

## 9. Plan de rollout

- 1 PR con migración + módulo.

## 10. Open questions

- ¿Permitir unidades imperiales del lado servidor? **No**, solo métrico. El cliente convierte.
- ¿Soportar editar una medición vía `PATCH /measurements/:id`? Opcional, post-MVP.
