# RFC F-10 — Notificaciones push (FCM)

| Campo | Valor |
|---|---|
| **Feature ID** | F-10 |
| **PRD asociado** | [`../prds/PF-10-push-notifications.md`](../prds/PF-10-push-notifications.md) |
| **Status** | Propuesto |
| **Esfuerzo** | M-L (3-4 días) |

## 1. TL;DR

Módulo `NotificationsModule` con un `PushService` que delega en `firebase-admin/messaging`. Modelo `DeviceToken`, flag `pushEnabled` en `User`, y hooks en eventos clave.

## 2. Contexto técnico

- `firebase-admin` ya está instalado (v13).
- El SDK soporta `messaging().send()` y `messaging().sendEachForMulticast()`.

## 3. Diseño propuesto

### 3.1 Schema

```prisma
model DeviceToken {
  id         String   @id @default(uuid())
  userId     String
  token      String   @unique
  platform   String   // "ios" | "android" | "web"
  lastSeenAt DateTime @default(now())
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model User {
  ...
  pushEnabled  Boolean       @default(true)
  deviceTokens DeviceToken[]
}
```

Migración: `add_device_token_and_push_flag`.

### 3.2 Endpoints

```typescript
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('register-token')
  register(@Request() req, @Body() dto: RegisterTokenDto) {
    return this.service.registerToken(req.user.id, dto);
  }

  @Delete('register-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  unregister(@Request() req, @Body() body: { token: string }) {
    return this.service.unregisterToken(req.user.id, body.token);
  }
}
```

### 3.3 DTO

```typescript
export class RegisterTokenDto {
  @IsString() @MinLength(20) token: string;
  @IsIn(['ios', 'android', 'web']) platform: 'ios' | 'android' | 'web';
}
```

### 3.4 Service

```typescript
@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
    private readonly logger = new Logger(PushService.name),
  ) {}

  async sendToUser(userId: string, payload: { title: string; body: string; data?: Record<string, string> }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pushEnabled: true, deviceTokens: { select: { token: true } } },
    });
    if (!user || !user.pushEnabled || user.deviceTokens.length === 0) return;

    const tokens = user.deviceTokens.map((d) => d.token);
    const response = await this.firebase.getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });

    // Limpiar tokens invalidados
    const invalid: string[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered' ||
                         r.error?.code === 'messaging/invalid-registration-token')) {
        invalid.push(tokens[idx]);
      }
    });
    if (invalid.length) {
      await this.prisma.deviceToken.deleteMany({ where: { token: { in: invalid } } });
      this.logger.log(`Cleaned ${invalid.length} invalid tokens`);
    }
  }
}
```

### 3.5 Service de registro

```typescript
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async registerToken(userId: string, dto: RegisterTokenDto) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, lastSeenAt: new Date(), platform: dto.platform },
    });
    return { ok: true };
  }

  async unregisterToken(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
  }
}
```

### 3.6 Hooks de negocio

- **Racha**: en `ProgressService.updateStreak`, si `newStreak ∈ {7, 14, 30, 60, 90}` → `pushService.sendToUser(...)`.
- **PR** (F-05): cuando se inserte un `WorkoutSet` que supere el `bestOneRm` actual del ejercicio → push. (Requiere consultar el PR previo en la transacción).
- **Cancelación sub** (F-08): tras cancelar, push informativo con días restantes.

## 4. Alternativas consideradas

- **OneSignal / Expo Push**: rechazado — ya tenemos Firebase Admin, evitamos costos extra.
- **Cola con BullMQ**: futuro — el MVP usa fire-and-forget con `await`.

## 5. Migraciones / compatibilidad

- Migración nueva.
- Sin breaking changes.

## 6. Seguridad

- Tokens no son secretos pero asociados al usuario logueado.
- Validar que el token tenga formato razonable (`MinLength(20)`).
- Limitar payloads a no llevar info sensible.

## 7. Performance

- `sendEachForMulticast` soporta hasta 500 tokens por call. Para un usuario con N<10 dispositivos es trivial.
- Si la app crece a campañas masivas → BullMQ + workers.

## 8. Testing

### Unit
- `registerToken` upsert.
- Limpieza de tokens invalidados.
- `sendToUser` con `pushEnabled=false` → no llama FCM.

### E2E
- Mock de `firebase.getMessaging()` para tests de integración.

## 9. Plan de rollout

| Día | Acción |
|---|---|
| D0 | Modelo + endpoints + service en staging. |
| D1 | Cliente móvil empieza a registrar tokens (release coordinada). |
| D2-3 | Activar hooks de racha y PR. |
| Semana 1 | Monitor de fallos y limpieza automática. |

## 10. Open questions

- ¿Cómo gestionar `pushEnabled` granular (silenciar solo cierto tipo)? Por ahora un único flag. Granularidad fina post-MVP.
- ¿Persistir un historial de notificaciones enviadas? Útil para feed in-app; **postergado**.
