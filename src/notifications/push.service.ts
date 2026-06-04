import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from '../auth/firebase-admin.service';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  /** Fire-and-forget; does not block the HTTP request. */
  sendToUserAsync(userId: string, payload: PushPayload): void {
    void this.sendToUser(userId, payload).catch((err) => {
      this.logger.warn(
        `Push failed for user ${userId}: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        pushEnabled: true,
        deviceTokens: { select: { token: true } },
      },
    });

    if (!user?.pushEnabled || user.deviceTokens.length === 0) {
      return;
    }

    const tokens = user.deviceTokens.map((d) => d.token);
    await this.sendMulticastWithRetry(tokens, payload);
  }

  /**
   * Ready for F-08 (#62) subscription cancel hook.
   */
  notifySubscriptionCanceled(userId: string, daysRemaining: number): void {
    this.sendToUserAsync(userId, {
      title: 'Suscripción cancelada',
      body: `Tu plan sigue activo ${daysRemaining} día(s) más.`,
      data: { type: 'subscription_canceled' },
    });
  }

  private async sendMulticastWithRetry(
    tokens: string[],
    payload: PushPayload,
  ): Promise<void> {
    const messaging = this.firebase.getMessaging();

    const send = () =>
      messaging.sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });

    let response;
    try {
      response = await send();
    } catch (firstError) {
      this.logger.warn('FCM send failed, retrying once...');
      await this.delay(500);
      try {
        response = await send();
      } catch (retryError) {
        this.logger.error('FCM send failed after retry', retryError);
        return;
      }
    }

    const invalid: string[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && r.error?.code && INVALID_TOKEN_CODES.has(r.error.code)) {
        invalid.push(tokens[idx]);
      }
    });

    if (invalid.length > 0) {
      await this.prisma.deviceToken.deleteMany({
        where: { token: { in: invalid } },
      });
      this.logger.log(`Cleaned ${invalid.length} invalid FCM token(s)`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
