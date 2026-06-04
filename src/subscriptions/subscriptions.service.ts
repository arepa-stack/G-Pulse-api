import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan } from '@prisma/client';
import { PushService } from '../notifications/push.service';

const MS_PER_DAY = 86400000;

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly pushService?: PushService,
  ) {}

  async createSubscription(userId: string, plan: SubscriptionPlan) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await this.prisma.user.update({
      where: { id: userId },
      data: { plan },
    });

    return this.prisma.subscription.upsert({
      where: { userId },
      update: { plan, startDate, endDate, isActive: true },
      create: { userId, plan, startDate, endDate, isActive: true },
    });
  }

  async getStatus(userId: string) {
    const [sub, user] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      }),
    ]);

    if (!sub) {
      return {
        plan: user?.plan ?? SubscriptionPlan.BASIC,
        isActive: false,
        startDate: null,
        endDate: null,
        daysRemaining: null,
      };
    }

    const daysRemaining = sub.endDate
      ? Math.max(
          0,
          Math.ceil((sub.endDate.getTime() - Date.now()) / MS_PER_DAY),
        )
      : null;

    return {
      plan: sub.plan,
      isActive: sub.isActive,
      startDate: sub.startDate,
      endDate: sub.endDate,
      daysRemaining,
    };
  }

  async cancel(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!sub || !sub.isActive) {
      return { message: 'No active subscription to cancel' };
    }

    const now = new Date();
    await this.prisma.subscription.update({
      where: { userId },
      data: { isActive: false, endDate: now },
    });

    const daysRemaining = Math.max(
      0,
      Math.ceil((now.getTime() - Date.now()) / MS_PER_DAY),
    );
    this.pushService?.notifySubscriptionCanceled(userId, daysRemaining);

    return {
      message:
        'Subscription canceled. Plan benefits remain until endDate.',
    };
  }

  async checkQuota(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return false;

    const isPaidPlan =
      user.plan === SubscriptionPlan.PRO ||
      user.plan === SubscriptionPlan.EXPERT;

    if (isPaidPlan) {
      return true;
    }

    if (user.quotasUsed < 1) return true;

    return false;
  }
}
