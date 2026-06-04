import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role, SubscriptionPlan } from '@prisma/client';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { CreateMuscleDto } from './dto/create-muscle.dto';
import { UpdateMuscleDto } from './dto/update-muscle.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async findAllUsers(
    page: number = 1,
    limit: number = 10,
    search?: string,
    plan?: SubscriptionPlan,
    role?: Role,
  ) {
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

  async updateUser(id: string, dto: UpdateAdminUserDto) {
    const hasField =
      dto.name !== undefined ||
      dto.level !== undefined ||
      dto.plan !== undefined ||
      dto.role !== undefined;

    if (!hasField) {
      throw new BadRequestException('At least one field is required');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.plan !== undefined && { plan: dto.plan }),
        ...(dto.role !== undefined && { role: dto.role }),
      },
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
      this.prisma.user.delete({ where: { id } }),
    ]);

    return { message: 'User deleted successfully' };
  }

  // ---- EXERCISES ----

  async createExercise(data: CreateExerciseDto) {
    const { imageUrls, ...exerciseData } = data;

    return this.prisma.exercise.create({
      data: {
        ...(exerciseData as any),
        media:
          imageUrls && imageUrls.length > 0
            ? {
                create: imageUrls.map((url) => ({ url })),
              }
            : undefined,
      },
      include: { media: true },
    });
  }

  async updateExercise(id: string, data: UpdateExerciseDto) {
    const exercise = await this.prisma.exercise.findUnique({ where: { id } });
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    const { imageUrls, ...exerciseData } = data;

    if (imageUrls !== undefined) {
      await this.prisma.exerciseMedia.deleteMany({ where: { exerciseId: id } });
    }

    return this.prisma.exercise.update({
      where: { id },
      data: {
        ...(exerciseData as any),
        media:
          imageUrls && imageUrls.length > 0
            ? {
                create: imageUrls.map((url) => ({ url })),
              }
            : undefined,
      },
      include: { media: true },
    });
  }

  async deleteExercise(id: string) {
    const exercise = await this.prisma.exercise.findUnique({ where: { id } });
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.routineExercise.deleteMany({ where: { exerciseId: id } }),
      this.prisma.exerciseMedia.deleteMany({ where: { exerciseId: id } }),
      this.prisma.exercise.delete({ where: { id } }),
    ]);

    return { message: 'Exercise deleted successfully' };
  }

  // ---- ROUTINES ----

  async findAllRoutines(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where: Prisma.RoutineWhereInput = {
      ...(search && {
        OR: [{ name: { contains: search, mode: 'insensitive' } }],
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
          _count: { select: { exercises: true } },
        },
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
            exercise: true,
          },
          orderBy: { order: 'asc' },
        },
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
      routinesCreatedToday,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.routine.count(),
      this.prisma.activityLog
        .findMany({
          where: { date: { gte: startOfToday } },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((logs) => logs.length),
      this.prisma.user.count({
        where: { plan: { in: ['PRO', 'EXPERT'] } },
      }),
      this.prisma.routine.count({
        where: { createdAt: { gte: startOfToday } },
      }),
    ]);

    return {
      totalUsers,
      activeUsersToday,
      premiumUsers,
      totalRoutines,
      routinesCreatedToday,
      premiumConversionRate:
        totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0,
    };
  }

  // ---- MUSCLES (catálogo admin, F-14) ----

  async findAllMuscles() {
    return this.prisma.muscle.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { primaryExercises: true, secondaryExercises: true },
        },
      },
    });
  }

  async createMuscle(dto: CreateMuscleDto) {
    try {
      return await this.prisma.muscle.create({ data: dto });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `A muscle named "${dto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  async updateMuscle(id: string, dto: UpdateMuscleDto) {
    const muscle = await this.prisma.muscle.findUnique({ where: { id } });
    if (!muscle) {
      throw new NotFoundException(`Muscle with ID ${id} not found`);
    }

    try {
      return await this.prisma.muscle.update({ where: { id }, data: dto });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `A muscle named "${dto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  async deleteMuscle(id: string, force = false) {
    const muscle = await this.prisma.muscle.findUnique({
      where: { id },
      include: {
        _count: {
          select: { primaryExercises: true, secondaryExercises: true },
        },
      },
    });

    if (!muscle) {
      throw new NotFoundException(`Muscle with ID ${id} not found`);
    }

    const references =
      muscle._count.primaryExercises + muscle._count.secondaryExercises;

    if (references > 0 && !force) {
      throw new ConflictException({
        message: `Muscle is referenced by ${references} exercise(s). Use ?force=true to disconnect and delete.`,
        references,
      });
    }

    // Desasocia las relaciones M:N y borra de forma atómica.
    await this.prisma.$transaction([
      this.prisma.muscle.update({
        where: { id },
        data: {
          primaryExercises: { set: [] },
          secondaryExercises: { set: [] },
        },
      }),
      this.prisma.muscle.delete({ where: { id } }),
    ]);

    return { message: 'Muscle deleted successfully' };
  }

  // ---- CATEGORIES (catálogo admin, F-14) ----

  async findAllCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { exercises: true } } },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({ data: dto });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `A category named "${dto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    try {
      return await this.prisma.category.update({ where: { id }, data: dto });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `A category named "${dto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  async deleteCategory(id: string, force = false) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { exercises: true } } },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    const references = category._count.exercises;

    if (references > 0 && !force) {
      throw new ConflictException({
        message: `Category is referenced by ${references} exercise(s). Use ?force=true to detach and delete.`,
        references,
      });
    }

    // Deja categoryId=null en los ejercicios afectados y borra de forma atómica.
    await this.prisma.$transaction([
      this.prisma.category.update({
        where: { id },
        data: { exercises: { set: [] } },
      }),
      this.prisma.category.delete({ where: { id } }),
    ]);

    return { message: 'Category deleted successfully' };
  }
}
