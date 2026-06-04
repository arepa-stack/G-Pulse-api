import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import { FindAllRoutinesDto } from '../routines/dto/find-all-routines.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async findOne(
    uniqueInput: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
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
          },
        },
        activityLogs: {
          select: {
            calories: true,
            duration: true,
          },
        },
      },
    });

    if (!user) return null;

    const totalCalories = user.activityLogs.reduce(
      (sum, log) => sum + log.calories,
      0,
    );
    const totalDuration = user.activityLogs.reduce(
      (sum, log) => sum + log.duration,
      0,
    );

    return {
      trainingStreak: user.trainingStreak,
      routinesCount: user._count.routines,
      totalWorkouts: user._count.activityLogs,
      totalCalories,
      totalDurationMinutes: totalDuration,
      plan: user.plan,
      level: user.level,
    };
  }

  async getFavorites(userId: string, q: FindAllRoutinesDto) {
    const take = q.limit ? parseInt(q.limit) : 20;
    const skip = q.page ? (parseInt(q.page) - 1) * take : 0;

    const where: Prisma.UserFavoriteWhereInput = {
      userId,
      ...(q.search && {
        routine: {
          name: { contains: q.search, mode: 'insensitive' },
        },
      }),
    };

    const [favorites, total] = await this.prisma.$transaction([
      this.prisma.userFavorite.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          routine: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: { select: { exercises: true } },
            },
          },
        },
      }),
      this.prisma.userFavorite.count({ where }),
    ]);

    const data = favorites.map((fav) => fav.routine);

    return {
      data,
      meta: {
        total,
        page: q.page ? +q.page : 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }
}
