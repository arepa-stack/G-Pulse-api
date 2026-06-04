import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertScheduleDto } from './dto/upsert-schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, dto: UpsertScheduleDto) {
    const routine = await this.prisma.routine.findUnique({
      where: { id: dto.routineId },
      select: { creatorId: true, isPublic: true },
    });

    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    if (routine.creatorId !== userId && !routine.isPublic) {
      throw new ForbiddenException(
        'You do not have permission to schedule this routine',
      );
    }

    return this.prisma.routineSchedule.upsert({
      where: {
        userId_dayOfWeek: {
          userId,
          dayOfWeek: dto.dayOfWeek,
        },
      },
      create: {
        userId,
        dayOfWeek: dto.dayOfWeek,
        routineId: dto.routineId,
        enabled: dto.enabled ?? true,
      },
      update: {
        routineId: dto.routineId,
        enabled: dto.enabled ?? true,
      },
      include: {
        routine: {
          select: {
            id: true,
            name: true,
            _count: {
              select: { exercises: true },
            },
          },
        },
      },
    });
  }

  async list(userId: string) {
    const schedules = await this.prisma.routineSchedule.findMany({
      where: { userId },
      include: {
        routine: {
          select: {
            id: true,
            name: true,
            _count: {
              select: { exercises: true },
            },
          },
        },
      },
    });

    const calendar = [];
    for (let d = 0; d <= 6; d++) {
      const scheduled = schedules.find((s) => s.dayOfWeek === d);
      calendar.push({
        dayOfWeek: d,
        routine: scheduled?.routine ?? null,
        enabled: scheduled?.enabled ?? false,
      });
    }

    return calendar;
  }

  async remove(userId: string, dayOfWeek: number) {
    const entry = await this.prisma.routineSchedule.findUnique({
      where: {
        userId_dayOfWeek: {
          userId,
          dayOfWeek,
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`No routine scheduled for day ${dayOfWeek}`);
    }

    await this.prisma.routineSchedule.delete({
      where: {
        userId_dayOfWeek: {
          userId,
          dayOfWeek,
        },
      },
    });
  }
}
