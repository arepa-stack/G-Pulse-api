# RFC F-01 — Seguridad: AuthGuard en endpoints expuestos

| Campo | Valor |
|---|---|
| **Feature ID** | F-01 |
| **PRD asociado** | [`../prds/PF-01-auth-guard-fix.md`](../prds/PF-01-auth-guard-fix.md) |
| **Status** | Propuesto |
| **Esfuerzo** | XS (medio día) |

## 1. TL;DR

Aplicar `AuthGuard('jwt')` a `POST /routines` y `POST /gemini/generate`. Eliminar `userId` del body y leerlo de `req.user.id`. Documentar con `@ApiBearerAuth()`.

## 2. Contexto técnico

- El proyecto usa Passport JWT (`src/auth/jwt.strategy.ts`) que ya valida tokens y popula `req.user = { id, email, role }`.
- Otros controladores (`UsersController`, `ProgressController`, `SubscriptionsController`) ya aplican el patrón `@UseGuards(AuthGuard('jwt'))` + `@ApiBearerAuth()`.
- Hay un `ValidationPipe` global con `forbidNonWhitelisted: true` que rechaza propiedades no declaradas en el DTO. Eso ayuda a forzar el cambio.

## 3. Diseño propuesto

### 3.1 `src/routines/routines.controller.ts`

```typescript
@ApiTags('routines')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new routine' })
  async createRoutine(@Request() req, @Body() dto: CreateRoutineDto) {
    return this.routinesService.createRoutine({ ...dto, userId: req.user.id });
  }
}
```

### 3.2 `src/routines/dto/create-routine.dto.ts`

Eliminar el campo `userId`:

```typescript
// QUITAR:
// @ApiProperty({ example: 'uuid-of-user' })
// @IsString()
// @IsNotEmpty()
// userId: string;
```

El servicio sigue recibiendo `userId` por su firma actual (`data: any` con `data.userId`), por lo que pasarlo desde el controller es suficiente. **No** se cambia `RoutinesService.createRoutine` en este RFC.

### 3.3 `src/gemini/gemini.controller.ts`

```typescript
@ApiTags('gemini')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate text using Gemini AI' })
  async generateText(@Request() req, @Body() body: GenerateTextDto) {
    return this.geminiService.generateText(
      body.prompt,
      false,
      req.user.id,
      body.forceUpdate,
      body.filters,
    );
  }
}
```

### 3.4 `src/gemini/dto/generate-text.dto.ts`

Eliminar el campo `userId` del DTO (queda solo `prompt`, `forceUpdate?`, `filters?`).

## 4. Alternativas consideradas

- **Mantener `userId` en body y validar contra `req.user.id`**: rechazado — duplica información y crea ambigüedad.
- **Aceptar `userId` opcional 1 release con warning**: viable como estrategia de migración. Implementación: aceptar el campo en el DTO con `@IsOptional()`, log warning si llega, pero **siempre** usar `req.user.id`. Documentado abajo en el plan de rollout.

## 5. Migraciones / compatibilidad

- **Schema BD**: ninguna.
- **API contract**: breaking change. Los clientes deben dejar de enviar `userId`.

**Plan de transición (recomendado)**:

1. Release N: agregar guards + leer `userId` de JWT, **mantener** el campo opcional en el DTO (`@IsOptional()`). Loggear si llega.
2. Release N+1: confirmar logs en producción que ningún cliente lo envía.
3. Release N+2: quitar el campo del DTO definitivamente.

## 6. Seguridad

- El guard JWT valida firma, expiración y existencia del usuario (delegado a `JwtStrategy.validate`).
- Eliminar `userId` del body previene **insecure direct object reference (IDOR)**.

## 7. Performance

- 1 verificación adicional por request (firma JWT). Costo en orden de microsegundos. No afecta el SLO.

## 8. Testing

### Unit
- `routines.controller.spec.ts`: agregar test que verifica que se llama a `routinesService.createRoutine` con `userId === req.user.id`, independientemente de lo que venga en body.
- `gemini.controller.spec.ts`: similar.

### E2E (`test/`)
- `POST /routines` sin Authorization → 401.
- `POST /routines` con JWT mock válido → 201.
- `POST /gemini/generate` sin Authorization → 401.

## 9. Plan de rollout

| Día | Acción |
|---|---|
| D0 | Merge a `main`, deploy a staging. |
| D0 | App móvil actualizada en su release simultánea (coordinado). |
| D1 | Release a producción si staging OK. |
| D7 | Quitar campo `userId` del DTO (si aplica plan de transición). |

## 10. Open questions

- ¿Coordinamos release simultáneo con app móvil y panel admin, o aplicamos plan de transición de 1 release?
- ¿Hay clientes externos (no controlados) consumiendo estos endpoints? → **No**, según la doc actual.
