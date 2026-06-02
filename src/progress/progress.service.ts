import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogActivityDto } from './dto/log-activity.dto';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  async logActivity(userId: string, data: LogActivityDto) {
    const { sets, routineId, ...activityData } = data;

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
      data: { trainingStreak: newStreak },
    });
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

    const prsMap = new Map<string, typeof sets[0]>();
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

