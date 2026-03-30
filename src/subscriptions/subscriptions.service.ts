import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
    constructor(private prisma: PrismaService) { }

    async createSubscription(userId: string, plan: SubscriptionPlan) {
        // Logic to set end date based on plan (e.g. 1 month)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        // Update User plan and create/update Subscription record
        await this.prisma.user.update({
            where: { id: userId },
            data: { plan }
        });

        return this.prisma.subscription.upsert({
            where: { userId },
            update: { plan, startDate, endDate, isActive: true },
            create: { userId, plan, startDate, endDate, isActive: true }
        });
    }

    async checkQuota(userId: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) return false;

        const isPaidPlan = user.plan === SubscriptionPlan.PRO || user.plan === SubscriptionPlan.EXPERT;

        // Feature: Check AI generation quota
        // This logic is now primarily handled in GeminiService.checkQuota
        // We keep this for backward compatibility or other feature checks if needed.

        if (isPaidPlan) {
            return true;
        }

        // Basic plan limit check (legacy logic, GeminiService has the real source of truth for AI)
        if (user.quotasUsed < 1) return true;

        return false;
    }
}
