import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { FindMeasurementsDto } from './dto/find-measurements.dto';

const METRIC_FIELDS = [
  'weightKg',
  'bodyFatPct',
  'waistCm',
  'chestCm',
  'armCm',
  'legCm',
  'hipCm',
] as const;

type MetricField = (typeof METRIC_FIELDS)[number];

@Injectable()
export class MeasurementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMeasurementDto) {
    const hasValue = METRIC_FIELDS.some(
      (k) => dto[k as keyof CreateMeasurementDto] !== undefined,
    );
    if (!hasValue) {
      throw new BadRequestException('Provide at least one metric');
    }

    return this.prisma.bodyMeasurement.create({
      data: {
        userId,
        notes: dto.notes,
        date: dto.date ? new Date(dto.date) : undefined,
        weightKg: dto.weightKg,
        bodyFatPct: dto.bodyFatPct,
        waistCm: dto.waistCm,
        chestCm: dto.chestCm,
        armCm: dto.armCm,
        legCm: dto.legCm,
        hipCm: dto.hipCm,
      },
    });
  }

  async findAll(userId: string, q: FindMeasurementsDto) {
    const take = q.limit ? Math.min(+q.limit, 100) : 30;
    const skip = q.page ? (+q.page - 1) * take : 0;

    const dateFilter: Prisma.DateTimeFilter = {};
    if (q.from) {
      dateFilter.gte = new Date(q.from);
    }
    if (q.to) {
      dateFilter.lte = new Date(q.to);
    }

    const where: Prisma.BodyMeasurementWhereInput = {
      userId,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.bodyMeasurement.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
      }),
      this.prisma.bodyMeasurement.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: q.page ? +q.page : 1,
        limit: take,
        totalPages: Math.ceil(total / take) || 0,
      },
    };
  }

  async latest(userId: string) {
    const all = await this.prisma.bodyMeasurement.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 100,
    });

    const result: Record<
      MetricField,
      { value: number; date: Date } | null
    > = {
      weightKg: null,
      bodyFatPct: null,
      waistCm: null,
      chestCm: null,
      armCm: null,
      legCm: null,
      hipCm: null,
    };

    for (const field of METRIC_FIELDS) {
      const found = all.find(
        (m) => m[field] !== null && m[field] !== undefined,
      );
      if (found && found[field] != null) {
        result[field] = {
          value: found[field] as number,
          date: found.date,
        };
      }
    }

    return result;
  }

  async remove(userId: string, id: string) {
    const measurement = await this.prisma.bodyMeasurement.findFirst({
      where: { id, userId },
    });

    if (!measurement) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.bodyMeasurement.delete({ where: { id } });
  }
}
