import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { ExercisesService } from '../exercises/exercises.service';
import { FindAllRoutinesDto } from './dto/find-all-routines.dto';
import { UpdateRoutineDto } from './dto/update-routine.dto';
import { RoutineExerciseDto } from './dto/routine-exercise.dto';

type RoutineExerciseClient = Pick<
  PrismaService,
  'exercise' | 'exerciseMedia' | '$queryRaw'
>;

@Injectable()
export class RoutinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly exercisesService: ExercisesService,
  ) {}

  // Flujo seguro: texto libre -> extractor -> SQL candidatos -> IA elige por id -> guardián valida.
  // Devuelve un PREVIEW (no guarda). El usuario confirma con POST /routines pasando los exerciseId.
  async generatePreview(userId: string, text: string) {
    let intent;
    try {
      intent = await this.geminiService.extractRoutineIntent(text);
    } catch (e) {
      console.error('extractRoutineIntent failed:', e);
      return {
        status: 'error',
        mensaje: 'El servicio de IA no está disponible en este momento. Intenta más tarde.',
      };
    }

    if (intent.intent !== 'rutina') {
      return {
        status: 'unsupported',
        mensaje:
          'Por ahora solo armo rutinas de entrenamiento 💪. Los planes de nutrición llegan pronto.',
      };
    }

    const faltan = (intent.faltan || []).filter((f) =>
      ['equipment', 'difficulty'].includes(f),
    );
    if (!intent.category) faltan.unshift('category');
    if (faltan.length) {
      return { status: 'needs_input', faltan: [...new Set(faltan)], intent };
    }

    let candidatosRaw = await this.exercisesService.findCandidates({
      category: intent.category!,
      equipment: intent.equipment ?? undefined,
      difficulty: intent.difficulty ?? undefined,
    });

    // Fallback: si el equipo específico no dio candidatos, reintenta sin filtrar por equipo.
    if (candidatosRaw.length === 0 && intent.equipment) {
      candidatosRaw = await this.exercisesService.findCandidates({
        category: intent.category!,
        difficulty: intent.difficulty ?? undefined,
      });
    }

    if (candidatosRaw.length === 0) {
      return {
        status: 'no_candidates',
        mensaje: 'No hay ejercicios que cumplan esos filtros.',
        filtros: intent,
      };
    }

    const pickName = (name: any): string =>
      name?.es || name?.en || (name ? String(Object.values(name)[0]) : '');
    const candidatos = candidatosRaw.map((c) => ({
      id: c.id,
      name: pickName(c.name),
      equipment: c.equipment,
    }));

    // Cuota: solo la generación cuenta (el extractor es barato).
    const canGenerate = await this.geminiService.checkQuota(userId);
    if (!canGenerate) {
      throw new HttpException(
        {
          status: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Daily AI Limit Reached for your plan.',
          type: 'LIMIT_REACHED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let ai;
    try {
      ai = await this.geminiService.generateRoutineFromCandidates(
        {
          difficulty: intent.difficulty ?? undefined,
          matices: intent.matices ?? undefined,
          restricciones: intent.restricciones ?? undefined,
          num_ejercicios: intent.num_ejercicios ?? undefined,
        },
        candidatos,
      );
    } catch (e) {
      console.error('generateRoutineFromCandidates failed:', e);
      return {
        status: 'error',
        mensaje: 'El servicio de IA no está disponible en este momento. Intenta más tarde.',
      };
    }
    await this.geminiService.incrementUsage(userId);

    // Guardián: solo IDs que existen en la BD. Los inventados se descartan (nunca se guardan).
    const ids = (ai.ejercicios || []).map((e) => e.exercise_id);
    const valid = await this.prisma.exercise.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        proTip: true,
        media: {
          where: { isPaused: false },
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: { url: true },
        },
      },
    });
    const validMap = new Map(valid.map((v) => [v.id, v]));

    const ejercicios = (ai.ejercicios || [])
      .filter((e) => validMap.has(e.exercise_id))
      .map((e) => {
        const ex = validMap.get(e.exercise_id)!;
        return {
          exerciseId: ex.id,
          name: ex.name,
          thumbnail: ex.thumbnail,
          image: ex.media[0]?.url ?? null,
          proTip: ex.proTip,
          sets: e.series,
          reps: e.reps,
          restSeconds: e.descanso_segundos,
        };
      });
    const descartados = ids.filter((id) => !validMap.has(id));

    return {
      status: 'ready',
      preview: {
        nombre_rutina: ai.nombre_rutina,
        nota_seguridad: ai.nota_seguridad ?? null,
        ejercicios,
      },
      meta: {
        candidatos: candidatos.length,
        generados: ids.length,
        descartados: descartados.length,
        idsDescartados: descartados,
      },
    };
  }

  private readonly routineExerciseInclude = {
    media: true,
    exercise: {
      include: {
        category: true,
        media: {
          where: {
            isPaused: false,
          },
        },
      },
    },
  } as const;

  private async resolveExercise(
    client: RoutineExerciseClient,
    exData: RoutineExerciseDto,
  ) {
    if (exData.exerciseId) {
      return client.exercise.findUnique({ where: { id: exData.exerciseId } });
    }

    if (!exData.exerciseName) {
      return null;
    }

    const matches = await client.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Exercise"
      WHERE "name"->>'en' ILIKE ${exData.exerciseName}
         OR "name"->>'es' ILIKE ${exData.exerciseName}
         OR "name"->>'it' ILIKE ${exData.exerciseName}
         OR "name"->>'tr' ILIKE ${exData.exerciseName}
      LIMIT 1
    `;

    if (matches.length > 0) {
      return client.exercise.findUnique({ where: { id: matches[0].id } });
    }

    // ponytail: nunca crear ejercicios desde input de rutina — la BD es la fuente de verdad.
    // Un nombre que no matchea (IA alucinada o typo) se descarta, no se inserta un fantasma.
    console.warn(`resolveExercise: no match for "${exData.exerciseName}" — slot skipped`);
    return null;
  }

  private async validateMediaId(
    client: RoutineExerciseClient,
    userId: string,
    mediaId: string | undefined,
    exerciseId: string,
  ): Promise<string | null> {
    if (!mediaId) return null;

    const media = await client.exerciseMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, userId: true, exerciseId: true, isPaused: true },
    });

    if (!media || media.isPaused) {
      throw new BadRequestException('Media not found');
    }
    if (media.userId !== userId) {
      throw new ForbiddenException('You can only link your own media to a routine');
    }
    if (media.exerciseId !== exerciseId) {
      throw new BadRequestException('Media does not belong to the selected exercise');
    }

    return media.id;
  }

  private async createRoutineExercises(
    client: RoutineExerciseClient,
    routineId: string,
    userId: string,
    exercises: RoutineExerciseDto[],
  ) {
    for (let i = 0; i < exercises.length; i++) {
      const exData = exercises[i];
      const exercise = await this.resolveExercise(client, exData);
      if (!exercise) continue;

      const mediaId = await this.validateMediaId(
        client,
        userId,
        exData.mediaId,
        exercise.id,
      );

      await (client as PrismaService).routineExercise.create({
        data: {
          routineId,
          exerciseId: exercise.id,
          mediaId,
          order: i + 1,
          sets: exData.sets || 3,
          reps: exData.reps || 10,
          duration:
            exData.duration && !isNaN(Number(exData.duration))
              ? Number(exData.duration)
              : null,
        },
      });
    }
  }

  async createRoutine(data: any) {
    if (!data.name || !data.userId) {
      throw new HttpException(
        'Name and userId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    let exercises: RoutineExerciseDto[] = data.exercises || [];

    if (data.fromAi && data.aiPrompt) {
      console.log(`Generating routine from AI: ${data.aiPrompt}`);
      const aiResponse = await this.geminiService.generateRoutineJson(
        data.aiPrompt,
      );

      if (aiResponse && Array.isArray(aiResponse.exercises)) {
        exercises = aiResponse.exercises;
      }
    }

    const routine = await this.prisma.routine.create({
      data: {
        name: data.name,
        description: data.description,
        isPublic: !!data.isPublic,
        creatorId: data.userId,
      },
    });

    await this.createRoutineExercises(
      this.prisma,
      routine.id,
      data.userId,
      exercises,
    );

    return this.prisma.routine.findUnique({
      where: { id: routine.id },
      include: {
        exercises: {
          include: this.routineExerciseInclude,
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async findAllForUser(userId: string, q: FindAllRoutinesDto) {
    const take = q.limit ? parseInt(q.limit) : 20;
    const skip = q.page ? (parseInt(q.page) - 1) * take : 0;

    const where: Prisma.RoutineWhereInput = {
      creatorId: userId,
      ...(q.search && {
        name: { contains: q.search, mode: 'insensitive' },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.routine.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { exercises: true } },
          // First exercise (order 0) with its cover image, for the routine card thumbnail
          exercises: {
            orderBy: { order: 'asc' },
            take: 1,
            select: {
              media: { select: { url: true } },
              exercise: {
                select: {
                  thumbnail: true,
                  media: {
                    where: { isPaused: false },
                    take: 1,
                    orderBy: { createdAt: 'asc' },
                    select: { url: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.routine.count({ where }),
    ]);

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

  async getPublicRoutines(q: FindAllRoutinesDto) {
    const take = q.limit ? parseInt(q.limit) : 20;
    const skip = q.page ? (parseInt(q.page) - 1) * take : 0;

    const where: Prisma.RoutineWhereInput = {
      isPublic: true,
      ...(q.search && {
        name: { contains: q.search, mode: 'insensitive' },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.routine.findMany({
        where,
        skip,
        take,
        orderBy: { likes: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              plan: true,
            },
          },
          _count: { select: { exercises: true } },
          // Primeros 3 ejercicios (order asc) con su imagen, para los thumbnails del card.
          // Solo imágenes: un video no sirve de portada (el cliente no puede pintarlo como imagen).
          exercises: {
            orderBy: { order: 'asc' },
            take: 3,
            select: {
              media: { select: { url: true, type: true } },
              exercise: {
                select: {
                  thumbnail: true,
                  media: {
                    where: { isPaused: false, type: 'IMAGE' },
                    take: 1,
                    orderBy: { createdAt: 'asc' },
                    select: { url: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.routine.count({ where }),
    ]);

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

  async findOneForUser(userId: string, id: string) {
    const routine = await this.prisma.routine.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        exercises: {
          include: {
            media: true,
            exercise: {
              include: {
                category: true,
                media: {
                  where: {
                    isPaused: false,
                    OR: [
                      { userId: null },
                      { isPublic: true },
                      { userId },
                    ],
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!routine || (routine.creatorId !== userId && !routine.isPublic)) {
      throw new NotFoundException('Routine not found');
    }

    return routine;
  }

  async updateForUser(userId: string, id: string, dto: UpdateRoutineDto) {
    const owned = await this.prisma.routine.findFirst({
      where: { id, creatorId: userId },
      select: { id: true },
    });

    if (!owned) {
      throw new NotFoundException('Routine not found');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.exercises !== undefined) {
        await tx.routineExercise.deleteMany({ where: { routineId: id } });
        await this.createRoutineExercises(tx, id, userId, dto.exercises);
      }

      return tx.routine.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        },
        include: {
          exercises: {
            include: this.routineExerciseInclude,
            orderBy: { order: 'asc' },
          },
        },
      });
    });
  }

  async removeForUser(userId: string, id: string) {
    const owned = await this.prisma.routine.findFirst({
      where: { id, creatorId: userId },
      select: { id: true },
    });

    if (!owned) {
      throw new NotFoundException('Routine not found');
    }

    await this.prisma.$transaction([
      this.prisma.routineExercise.deleteMany({ where: { routineId: id } }),
      this.prisma.userFavorite.deleteMany({ where: { routineId: id } }),
      this.prisma.routine.delete({ where: { id } }),
    ]);
  }

  private async getPublicRoutineOrThrow(routineId: string) {
    const routine = await this.prisma.routine.findUnique({
      where: { id: routineId },
      select: { isPublic: true },
    });

    if (!routine) {
      throw new NotFoundException('Routine not found');
    }
    if (!routine.isPublic) {
      throw new ForbiddenException('Only public routines can be liked or favorited');
    }

    return routine;
  }

  async like(userId: string, routineId: string) {
    await this.getPublicRoutineOrThrow(routineId);

    await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.routineLike.createMany({
        data: [{ userId, routineId }],
        skipDuplicates: true,
      });

      if (inserted.count === 1) {
        await tx.routine.update({
          where: { id: routineId },
          data: { likes: { increment: 1 } },
        });
      }
    });
  }

  async unlike(userId: string, routineId: string) {
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.routineLike.deleteMany({
        where: { userId, routineId },
      });

      if (removed.count === 1) {
        await tx.routine.update({
          where: { id: routineId },
          data: { likes: { decrement: 1 } },
        });
        await tx.routine.updateMany({
          where: { id: routineId, likes: { lt: 0 } },
          data: { likes: 0 },
        });
      }
    });
  }

  async getToday(userId: string) {
    const day = new Date().getDay();
    const row = await this.prisma.routineSchedule.findFirst({
      where: {
        userId,
        dayOfWeek: day,
        enabled: true,
      },
      include: {
        routine: {
          include: {
            exercises: {
              include: {
                media: true,
                exercise: {
                  include: {
                    media: {
                      where: {
                        isPaused: false,
                        OR: [
                          { userId: null },
                          { isPublic: true },
                          { userId },
                        ],
                      },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    return row ? row.routine : null;
  }

  async favorite(userId: string, routineId: string) {
    await this.getPublicRoutineOrThrow(routineId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userFavorite.createMany({
        data: [{ userId, routineId }],
        skipDuplicates: true,
      });
    });
  }

  async unfavorite(userId: string, routineId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.userFavorite.deleteMany({
        where: { userId, routineId },
      });
    });
  }
}
