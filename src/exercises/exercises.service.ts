import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExercisesService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ExerciseCreateInput) {
    return this.prisma.exercise.create({ data });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ExerciseWhereUniqueInput;
    where?: Prisma.ExerciseWhereInput;
    orderBy?: Prisma.ExerciseOrderByWithRelationInput;
    search?: string;
    user?: { id: string; role: string };
  }) {
    const { skip, take, cursor, where = {}, orderBy, search, user } = params;

    if (search) {
      const matchingExercises = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Exercise"
        WHERE "name"->>'en' ILIKE ${`%${search}%`}
           OR "name"->>'es' ILIKE ${`%${search}%`}
           OR "name"->>'it' ILIKE ${`%${search}%`}
           OR "name"->>'tr' ILIKE ${`%${search}%`}
      `;
      const ids = matchingExercises.map((e) => e.id);
      where.id = { in: ids };
    }

    const mediaFilter =
      user?.role === 'ADMIN'
        ? true
        : {
            where: {
              isPaused: false,
              OR: [
                { userId: null },
                { isPublic: true },
                ...(user?.id ? [{ userId: user.id }] : []),
              ],
            },
          };

    return this.prisma.exercise.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        media: mediaFilter,
        primaryMuscles: true,
        secondaryMuscles: true,
        category: true,
      },
    });
  }

  async findOne(id: string, user?: { id: string; role: string }) {
    const mediaFilter =
      user?.role === 'ADMIN'
        ? true
        : {
            where: {
              isPaused: false,
              OR: [
                { userId: null },
                { isPublic: true },
                ...(user?.id ? [{ userId: user.id }] : []),
              ],
            },
          };

    return this.prisma.exercise.findUnique({
      where: { id },
      include: { media: mediaFilter },
    });
  }
}
