# RFC F-08 — Gestión de suscripción

| Campo | Valor |
|---|---|
| **Feature ID** | F-08 |
| **PRD asociado** | [`../prds/PF-08-subscription-management.md`](../prds/PF-08-subscription-management.md) |
| **Status** | Propuesto |
| **Esfuerzo** | M (2 días: endpoints + cron) |

## 1. TL;DR

Dos endpoints (`GET /subscriptions/me`, `POST /subscriptions/cancel`) + un cron diario que downgradea usuarios con suscripción expirada.

## 2. Contexto técnico

- `Subscription` ya existe: `{ userId @unique, plan, startDate, endDate?, isActive }`.
- `@nestjs/schedule` aún no está instalado; hay que agregarlo.

## 3. Diseño propuesto

### 3.1 Endpoints

```typescript
@Get('me')
async getMine(@Request() req) {
  return this.subscriptionsService.getStatus(req.user.id);
}

@Post('cancel')
async cancel(@Request() req) {
  return this.subscriptionsService.cancel(req.user.id);
}
```

### 3.2 Service

```typescript
async getStatus(userId: string) {
  const [sub, user] = await Promise.all([
    this.prisma.subscription.findUnique({ where: { userId } }),
    this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
  ]);
  const now = Date.now();
  if (!sub) {
    return { plan: user?.plan ?? 'BASIC', isActive: false, startDate: null, endDate: null, daysRemaining: null };
  }
  const daysRemaining = sub.endDate ? Math.max(0, Math.ceil((sub.endDate.getTime() - now) / 86400000)) : null;
  return { plan: sub.plan, isActive: sub.isActive, startDate: sub.startDate, endDate: sub.endDate, daysRemaining };
}

async cancel(userId: string) {
  const sub = await this.prisma.subscription.findUnique({ where: { userId } });
  if (!sub || !sub.isActive) {
    return { message: 'No active subscription to cancel' };
  }
  await this.prisma.subscription.update({
    where: { userId },
    data: { isActive: false, endDate: new Date() },
  });
  return { message: 'Subscription canceled. Plan benefits remain until endDate.' };
}
```

### 3.3 Cron job

Instalar dependencia:

```bash
npm i @nestjs/schedule
```

```typescript
// src/subscriptions/subscriptions.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsCron {
  private readonly logger = new Logger(SubscriptionsCron.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async expireSubscriptions() {
    const now = new Date();
    const expired = await this.prisma.subscription.findMany({
      where: { endDate: { lt: now }, user: { plan: { not: 'BASIC' } } },
      select: { userId: true },
    });

    if (expired.length === 0) {
      this.logger.log('No expired subscriptions to process');
      return;
    }

    const userIds = expired.map((e) => e.userId);
    await this.prisma.$transaction([
      this.prisma.user.updateMany({ where: { id: { in: userIds } }, data: { plan: 'BASIC' } }),
      this.prisma.subscription.updateMany({ where: { userId: { in: userIds } }, data: { isActive: false } }),
    ]);

    this.logger.log(`Downgraded ${userIds.length} expired subscriptions to BASIC`);
  }
}
```

Registrar en `SubscriptionsModule`:

```typescript
@Module({
  imports: [ScheduleModule.forRoot()],  // en AppModule, una sola vez
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsCron],
})
export class SubscriptionsModule {}
```

> `ScheduleModule.forRoot()` debe ir en `AppModule`, no en cada feature.

## 4. Alternativas consideradas

- **Downgrade inmediato al cancelar**: rechazado — mal UX. El usuario pagó hasta fin de mes.
- **Reemplazar `endDate=now` por `endDate=keep`**: rechazado por simplicidad. Marcar `isActive=false` ya señala la cancelación.
- **Usar Postgres `pg_cron`**: complica la portabilidad (Supabase soporta pero requiere extensión). Mejor un cron de aplicación.

## 5. Migraciones / compatibilidad

- Ninguna migración de BD.
- Cambio aditivo en API.

## 6. Seguridad

- Endpoints bajo JWT.
- Cron es interno y no expone superficies.

## 7. Performance

- Cron diario: `findMany` + `updateMany` paginables. Para 100K usuarios sigue siendo sub-segundo.

## 8. Testing

### Unit
- `cancel` idempotente.
- `getStatus` sin sub → BASIC default.
- Cron mockeando fecha: usuarios con `endDate < now` se downgradean.

### Manual
- En dev: setear `endDate` en el pasado, correr `npm run cron:run` (helper opcional) y verificar.

## 9. Plan de rollout

| Día | Acción |
|---|---|
| D0 | Endpoints + cron en staging. |
| D1 | Validar cron en staging con datos forzados. |
| D2 | Producción. |
| Semana 1 | Monitorear logs del cron para confirmar comportamiento. |

## 10. Open questions

- ¿Notificar al usuario por email cuando se le downgradea? Decisión de producto. Recomendado: sí, vía `MailService`.
- ¿Endpoint `POST /subscriptions/reactivate` para revertir una cancelación si aún hay tiempo? Útil pero opcional.
