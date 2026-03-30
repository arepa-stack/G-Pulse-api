import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProgressService {
    constructor(private prisma: PrismaService) { }

    async logActivity(userId: string, data: Omit<Prisma.ActivityLogCreateInput, 'user'>) {
        // Correct type usage for create
        const log = await this.prisma.activityLog.create({
            data: {
                ...data,
                user: { connect: { id: userId } }
            }
        });

        await this.updateStreak(userId);
        return log;
    }

    async updateStreak(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        const lastActivity = await this.prisma.activityLog.findFirst({
            where: { userId },
            orderBy: { date: 'desc' },
            skip: 1, // Get the activity BEFORE the one just logged
        });

        let newStreak = user.trainingStreak;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (lastActivity) {
            const lastDate = new Date(lastActivity.date);
            lastDate.setHours(0, 0, 0, 0);

            const diffTime = today.getTime() - lastDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                newStreak += 1;
            } else if (diffDays > 1) {
                newStreak = 1;
            }
            // If diffDays === 0, it means another activity was logged today, streak stays the same
        } else {
            newStreak = 1;
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { trainingStreak: newStreak }
        });
    }

    async getHistory(userId: string) {
        return this.prisma.activityLog.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            include: {
                routine: {
                    select: { name: true }
                }
            }
        });
    }
}
