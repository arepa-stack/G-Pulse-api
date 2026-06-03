import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { FindAllRoutinesDto } from './dto/find-all-routines.dto';
import { UpdateRoutineDto } from './dto/update-routine.dto';

@Injectable()
export class RoutinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
  ) {}

  async createRoutine(data: any) {
    if (!data.name || !data.userId) {
      throw new HttpException(
        'Name and userId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    let exercises = data.exercises || [];

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

    for (let i = 0; i < exercises.length; i++) {
      const exData = exercises[i];

      const matches = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Exercise"
        WHERE "name"->>'en' ILIKE ${exData.exerciseName}
           OR "name"->>'es' ILIKE ${exData.exerciseName}
           OR "name"->>'it' ILIKE ${exData.exerciseName}
           OR "name"->>'tr' ILIKE ${exData.exerciseName}
        LIMIT 1
      `;

      let exercise = matches.length > 0
        ? await this.prisma.exercise.findUnique({ where: { id: matches[0].id } })
        : null;

      if (!exercise) {
        exercise = await this.prisma.exercise.create({
          data: {
            name: { en: exData.exerciseName },
            description: { en: 'AI Generated' },
          },
        });
      }

      await this.prisma.routineExercise.create({
        data: {
          routineId: routine.id,
          exerciseId: exercise.id,
          order: i + 1,
          sets: exData.sets || 3,
          reps: exData.reps || 10,
          duration: exData.duration && !isNaN(Number(exData.duration)) ? Number(exData.duration) : null,
        },
      });
    }

    return this.prisma.routine.findUnique({
      where: { id: routine.id },
      include: {
        exercises: {
          include: { exercise: true },
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
        include: { _count: { select: { exercises: true } } },
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
            },
          },
          _count: { select: { exercises: true } },
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
        exercises: {
          include: { exercise: { include: { media: true } } },
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

        for (let i = 0; i < dto.exercises.length; i++) {
          const ex = dto.exercises[i];
          const matches = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Exercise"
            WHERE "name"->>'en' ILIKE ${ex.exerciseName}
               OR "name"->>'es' ILIKE ${ex.exerciseName}
               OR "name"->>'it' ILIKE ${ex.exerciseName}
               OR "name"->>'tr' ILIKE ${ex.exerciseName}
            LIMIT 1
          `;
          const exercise = matches.length > 0
            ? await tx.exercise.findUnique({ where: { id: matches[0].id } })
            : null;

          if (!exercise) continue;

          await tx.routineExercise.create({
            data: {
              routineId: id,
              exerciseId: exercise.id,
              order: i + 1,
              sets: ex.sets ?? 3,
              reps: ex.reps ?? 10,
              duration: ex.duration && !isNaN(Number(ex.duration)) ? Number(ex.duration) : null,
            },
          });
        }
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
          exercises: { include: { exercise: true }, orderBy: { order: 'asc' } },
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
}
