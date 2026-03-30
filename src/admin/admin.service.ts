import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role, SubscriptionPlan } from '@prisma/client';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';

@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService) { }

    async findAllUsers(page: number = 1, limit: number = 10, search?: string, plan?: SubscriptionPlan, role?: Role) {
        const skip = (page - 1) * limit;

        const where: Prisma.UserWhereInput = {
            ...(search && {
                OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    { name: { contains: search, mode: 'insensitive' } },
                ],
            }),
            ...(plan && { plan }),
            ...(role && { role }),
        };

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data: users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findUserById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                activityLogs: {
                    orderBy: { date: 'desc' },
                    take: 5,
                },
                _count: {
                    select: { routines: true, activityLogs: true },
                },
            },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return user;
    }

    async updateUser(id: string, data: Partial<Pick<Prisma.UserUpdateInput, 'name' | 'level' | 'plan' | 'role'>>) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async deleteUser(id: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        await this.prisma.$transaction([
            this.prisma.userFavorite.deleteMany({ where: { userId: id } }),
            this.prisma.activityLog.deleteMany({ where: { userId: id } }),
            this.prisma.routine.deleteMany({ where: { creatorId: id } }),
            this.prisma.subscription.deleteMany({ where: { userId: id } }),
            this.prisma.user.delete({ where: { id } })
        ]);

        return { message: 'User deleted successfully' };
    }

    // ---- EXERCISES ----

    async createExercise(data: CreateExerciseDto) {
        const { imageUrls, ...exerciseData } = data;

        return this.prisma.exercise.create({
            data: {
                ...exerciseData as any,
                images: imageUrls && imageUrls.length > 0 ? {
                    create: imageUrls.map(url => ({ url }))
                } : undefined,
            },
            include: { images: true }
        });
    }

    async updateExercise(id: string, data: UpdateExerciseDto) {
        const exercise = await this.prisma.exercise.findUnique({ where: { id } });
        if (!exercise) {
            throw new NotFoundException(`Exercise with ID ${id} not found`);
        }

        const { imageUrls, ...exerciseData } = data;

        if (imageUrls !== undefined) {
            await this.prisma.exerciseImage.deleteMany({ where: { exerciseId: id } });
        }

        return this.prisma.exercise.update({
            where: { id },
            data: {
                ...exerciseData as any,
                images: imageUrls && imageUrls.length > 0 ? {
                    create: imageUrls.map(url => ({ url }))
                } : undefined,
            },
            include: { images: true }
        });
    }

    async deleteExercise(id: string) {
        const exercise = await this.prisma.exercise.findUnique({ where: { id } });
        if (!exercise) {
            throw new NotFoundException(`Exercise with ID ${id} not found`);
        }

        await this.prisma.$transaction([
            this.prisma.routineExercise.deleteMany({ where: { exerciseId: id } }),
            this.prisma.exerciseImage.deleteMany({ where: { exerciseId: id } }),
            this.prisma.exercise.delete({ where: { id } })
        ]);

        return { message: 'Exercise deleted successfully' };
    }

    // ---- ROUTINES ----

    async findAllRoutines(page: number = 1, limit: number = 10, search?: string) {
        const skip = (page - 1) * limit;

        const where: Prisma.RoutineWhereInput = {
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [routines, total] = await Promise.all([
            this.prisma.routine.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    creator: { select: { name: true, email: true } },
                    _count: { select: { exercises: true } }
                }
            }),
            this.prisma.routine.count({ where }),
        ]);

        return {
            data: routines,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findRoutineById(id: string) {
        const routine = await this.prisma.routine.findUnique({
            where: { id },
            include: {
                creator: { select: { name: true, email: true } },
                exercises: {
                    include: {
                        exercise: true
                    },
                    orderBy: { order: 'asc' }
                }
            },
        });

        if (!routine) {
            throw new NotFoundException(`Routine with ID ${id} not found`);
        }

        return routine;
    }

    // ---- STATS DASHBOARD ----

    async getDashboardStats() {
        // Current date for "today" metrics or trends
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Run aggregations in parallel
        const [
            totalUsers,
            totalRoutines,
            activeUsersToday, // Approximation: users who created an activity log today
            premiumUsers,
            routinesCreatedToday
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.routine.count(),
            this.prisma.activityLog.findMany({
                where: { date: { gte: startOfToday } },
                select: { userId: true },
                distinct: ['userId']
            }).then(logs => logs.length),
            this.prisma.user.count({
                where: { plan: { in: ['PRO', 'EXPERT'] } }
            }),
            this.prisma.routine.count({
                where: { createdAt: { gte: startOfToday } }
            })
        ]);

        return {
            totalUsers,
            activeUsersToday,
            premiumUsers,
            totalRoutines,
            routinesCreatedToday,
            premiumConversionRate: totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0
        };
    }
}
