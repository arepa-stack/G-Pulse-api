import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogActivityDto } from './dto/log-activity.dto';
import { PushService } from '../notifications/push.service';

const STREAK_MILESTONES = new Set([7, 14, 30, 60, 90]);

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  async logActivity(userId: string, data: LogActivityDto) {
    const { sets, routineId, ...activityData } = data;

    const previousMaxByExercise = await this.getMaxWeightByExercise(
      userId,
      sets?.map((s) => s.exerciseId) ?? [],
    );

    const log = await this.prisma.activityLog.create({
      data: {
        ...activityData,
        user: { connect: { id: userId } },
        routine: routineId ? { connect: { id: routineId } } : undefined,
        sets:
          sets && sets.length > 0
            ? {
                create: sets.map((set) => ({
                  exerciseId: set.exerciseId,
                  setNumber: set.setNumber,
                  reps: set.reps,
                  weight: set.weight,
                })),
              }
            : undefined,
      },
      include: {
        sets: true,
      },
    });

    const newStreak = await this.updateStreak(userId);
    this.maybeNotifyStreakMilestone(userId, newStreak);
    this.maybeNotifyPersonalRecords(userId, sets, previousMaxByExercise);

    return log;
  }

  async updateStreak(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return 0;

    const lastActivity = await this.prisma.activityLog.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      skip: 1,
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
    } else {
      newStreak = 1;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { trainingStreak: newStreak },
    });

    return newStreak;
  }

  private maybeNotifyStreakMilestone(userId: string, newStreak: number) {
    if (!STREAK_MILESTONES.has(newStreak)) return;

    this.pushService.sendToUserAsync(userId, {
      title: '¡Racha de entrenamiento!',
      body: `¡${newStreak} días seguidos entrenando! Sigue así.`,
      data: { type: 'streak', streak: String(newStreak) },
    });
  }

  private async getMaxWeightByExercise(
    userId: string,
    exerciseIds: string[],
  ): Promise<Map<string, number>> {
    const uniqueIds = [...new Set(exerciseIds)];
    const map = new Map<string, number>();

    if (uniqueIds.length === 0) return map;

    const aggregates = await this.prisma.workoutSet.groupBy({
      by: ['exerciseId'],
      where: {
        exerciseId: { in: uniqueIds },
        weight: { not: null },
        activityLog: { userId },
      },
      _max: { weight: true },
    });

    for (const row of aggregates) {
      if (row._max.weight != null) {
        map.set(row.exerciseId, row._max.weight);
      }
    }

    return map;
  }

  private maybeNotifyPersonalRecords(
    userId: string,
    sets: LogActivityDto['sets'],
    previousMaxByExercise: Map<string, number>,
  ) {
    if (!sets?.length) return;

    const notified = new Set<string>();

    for (const set of sets) {
      if (set.weight == null || notified.has(set.exerciseId)) continue;

      const previousMax = previousMaxByExercise.get(set.exerciseId) ?? 0;
      if (set.weight > previousMax) {
        notified.add(set.exerciseId);
        this.pushService.sendToUserAsync(userId, {
          title: '¡Nuevo récord personal!',
          body: 'Has superado tu mejor marca en un ejercicio.',
          data: { type: 'pr', exerciseId: set.exerciseId },
        });
      }
    }
  }

  async getHistory(userId: string) {
    return this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      include: {
        routine: {
          select: { name: true },
        },
        sets: {
          include: {
            exercise: {
              select: { name: true },
            },
          },
          orderBy: { setNumber: 'asc' },
        },
      },
    });
  }

  async getPersonalRecords(userId: string) {
    const sets = await this.prisma.workoutSet.findMany({
      where: {
        activityLog: {
          userId,
        },
        weight: {
          not: null,
        },
      },
      include: {
        exercise: {
          select: {
            name: true,
          },
        },
        activityLog: {
          select: {
            date: true,
          },
        },
      },
    });

    const prsMap = new Map<string, (typeof sets)[0]>();
    for (const set of sets) {
      const existing = prsMap.get(set.exerciseId);
      if (!existing || (set.weight || 0) > (existing.weight || 0)) {
        prsMap.set(set.exerciseId, set);
      }
    }

    return Array.from(prsMap.values()).map((pr) => ({
      exerciseId: pr.exerciseId,
      exerciseName: pr.exercise.name,
      weight: pr.weight,
      reps: pr.reps,
      date: pr.activityLog.date,
    }));
  }

  async getExerciseHistory(userId: string, exerciseId: string) {
    return this.prisma.workoutSet.findMany({
      where: {
        exerciseId,
        activityLog: {
          userId,
        },
      },
      include: {
        activityLog: {
          select: {
            date: true,
          },
        },
      },
      orderBy: [
        {
          activityLog: {
            date: 'desc',
          },
        },
        {
          setNumber: 'asc',
        },
      ],
    });
  }
}
