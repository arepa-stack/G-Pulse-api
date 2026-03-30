import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExercisesService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.ExerciseCreateInput) {
        return this.prisma.exercise.create({ data });
    }

    async findAll(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.ExerciseWhereUniqueInput;
        where?: Prisma.ExerciseWhereInput;
        orderBy?: Prisma.ExerciseOrderByWithRelationInput;
    }) {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.exercise.findMany({
            skip,
            take,
            cursor,
            where,
            orderBy,
            include: {
                images: true,
                primaryMuscles: true,
                secondaryMuscles: true,
                category: true
            }
        });
    }

    async findOne(id: string) {
        return this.prisma.exercise.findUnique({
            where: { id },
            include: { images: true }
        });
    }
}
