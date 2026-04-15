import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.UserCreateInput): Promise<User> {
        return this.prisma.user.create({
            data,
        });
    }

    async findOne(uniqueInput: Prisma.UserWhereUniqueInput): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: uniqueInput,
        });
    }

    async update(id: string, data: Partial<Prisma.UserUpdateInput>) {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async updateByEmail(email: string, data: Partial<Prisma.UserUpdateInput>) {
        return this.prisma.user.update({
            where: { email },
            data,
        });
    }

    async getStats(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        routines: true,
                        activityLogs: true,
                    }
                },
                activityLogs: {
                    select: {
                        calories: true,
                        duration: true,
                    }
                }
            }
        });

        if (!user) return null;

        const totalCalories = user.activityLogs.reduce((sum, log) => sum + log.calories, 0);
        const totalDuration = user.activityLogs.reduce((sum, log) => sum + log.duration, 0);

        return {
            trainingStreak: user.trainingStreak,
            routinesCount: user._count.routines,
            totalWorkouts: user._count.activityLogs,
            totalCalories,
            totalDurationMinutes: totalDuration,
            plan: user.plan,
            level: user.level
        };
    }
}
