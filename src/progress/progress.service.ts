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

    const personalRecords = this.detectPersonalRecords(sets, previousMaxByExercise);
    if (personalRecords.length > 0) {
      this.pushService.sendToUserAsync(userId, {
        title: '¡Nuevo récord personal!',
        body: 'Has superado tu mejor marca en un ejercicio.',
        data: { type: 'pr', exerciseId: personalRecords[0].exerciseId },
      });
    }

    return { ...log, personalRecords };
  }

  /** Sets cuyo peso supera el máximo previo del ejercicio. Uno por ejercicio (el primero que lo supera). */
  private detectPersonalRecords(
    sets: LogActivityDto['sets'],
    previousMaxByExercise: Map<string, number>,
  ): Array<{ exerciseId: string; weight: number }> {
    if (!sets?.length) return [];

    const seen = new Set<string>();
    const prs: Array<{ exerciseId: string; weight: number }> = [];
    for (const set of sets) {
      if (set.weight == null || seen.has(set.exerciseId)) continue;
      const previousMax = previousMaxByExercise.get(set.exerciseId) ?? 0;
      if (set.weight > previousMax) {
        seen.add(set.exerciseId);
        prs.push({ exerciseId: set.exerciseId, weight: set.weight });
      }
    }
    return prs;
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
      data: {
        trainingStreak: newStreak,
        longestStreak: Math.max(user.longestStreak, newStreak),
      },
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
              select: {
                name: true,
                thumbnail: true,
                media: {
                  where: { type: 'IMAGE' },
                  orderBy: { createdAt: 'asc' },
                  take: 1,
                  select: { url: true },
                },
              },
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
    // Segundo mejor peso por ejercicio (estrictamente menor al PR), para el delta "+X kg".
    const previousMax = new Map<string, number>();
    for (const set of sets) {
      const existing = prsMap.get(set.exerciseId);
      if (!existing || (set.weight || 0) > (existing.weight || 0)) {
        prsMap.set(set.exerciseId, set);
      }
    }
    for (const set of sets) {
      const pr = prsMap.get(set.exerciseId);
      const w = set.weight || 0;
      if (!pr || w >= (pr.weight || 0)) continue; // ignora el propio PR y empates
      if (w > (previousMax.get(set.exerciseId) ?? 0)) previousMax.set(set.exerciseId, w);
    }

    return Array.from(prsMap.values()).map((pr) => ({
      exerciseId: pr.exerciseId,
      exerciseName: pr.exercise.name,
      weight: pr.weight,
      reps: pr.reps,
      date: pr.activityLog.date,
      previousWeight: previousMax.get(pr.exerciseId) ?? null,
    }));
  }

  /**
   * Último set realizado por ejercicio (batched), para mostrar "Última vez: 75kg x 8"
   * en la pantalla de inicio de sesión. Toma la sesión más reciente de cada ejercicio
   * y, dentro de ella, el set más pesado (set de trabajo principal).
   */
  async getLastSets(userId: string, exerciseIds: string[]) {
    const ids = [...new Set(exerciseIds)].filter(Boolean);
    if (ids.length === 0) return [];

    const sets = await this.prisma.workoutSet.findMany({
      where: { exerciseId: { in: ids }, activityLog: { userId } },
      select: {
        exerciseId: true,
        reps: true,
        weight: true,
        activityLog: { select: { date: true } },
      },
      orderBy: [{ activityLog: { date: 'desc' } }, { weight: 'desc' }],
    });

    const lastByExercise = new Map<
      string,
      { exerciseId: string; weight: number | null; reps: number; date: Date }
    >();
    for (const s of sets) {
      if (!lastByExercise.has(s.exerciseId)) {
        lastByExercise.set(s.exerciseId, {
          exerciseId: s.exerciseId,
          weight: s.weight,
          reps: s.reps,
          date: s.activityLog.date,
        });
      }
    }

    return Array.from(lastByExercise.values());
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

  /**
   * Resumen agregado del progreso de un ejercicio para un usuario.
   * Se calcula sobre los WorkoutSet ya guardados (sin tablas nuevas).
   */
  async getExerciseStats(userId: string, exerciseId: string) {
    const sets = await this.prisma.workoutSet.findMany({
      where: { exerciseId, activityLog: { userId } },
      select: {
        reps: true,
        weight: true,
        activityLogId: true,
        activityLog: { select: { date: true } },
      },
    });

    if (sets.length === 0) {
      return {
        exerciseId,
        timesPerformed: 0,
        totalSets: 0,
        totalReps: 0,
        maxWeight: null,
        maxReps: 0,
        totalVolume: 0,
        estimatedOneRepMax: null,
        firstPerformedAt: null,
        lastPerformedAt: null,
      };
    }

    const sessions = new Set<string>();
    let totalReps = 0;
    let maxWeight: number | null = null;
    let maxReps = 0;
    let totalVolume = 0;
    let estimatedOneRepMax: number | null = null;
    let first = sets[0].activityLog.date;
    let last = sets[0].activityLog.date;

    for (const s of sets) {
      sessions.add(s.activityLogId);
      totalReps += s.reps;
      maxReps = Math.max(maxReps, s.reps);
      if (s.weight != null) {
        maxWeight = maxWeight == null ? s.weight : Math.max(maxWeight, s.weight);
        totalVolume += s.reps * s.weight;
        // Epley: 1RM = peso * (1 + reps/30)
        const epley = s.weight * (1 + s.reps / 30);
        estimatedOneRepMax =
          estimatedOneRepMax == null
            ? epley
            : Math.max(estimatedOneRepMax, epley);
      }
      const d = s.activityLog.date;
      if (d < first) first = d;
      if (d > last) last = d;
    }

    return {
      exerciseId,
      timesPerformed: sessions.size,
      totalSets: sets.length,
      totalReps,
      maxWeight,
      maxReps,
      totalVolume,
      estimatedOneRepMax:
        estimatedOneRepMax == null
          ? null
          : Math.round(estimatedOneRepMax * 10) / 10,
      firstPerformedAt: first,
      lastPerformedAt: last,
    };
  }
}
