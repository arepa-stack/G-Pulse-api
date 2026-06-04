import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MeasurementsService', () => {
  let service: MeasurementsService;

  const mockPrismaService = {
    bodyMeasurement: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeasurementsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MeasurementsService>(MeasurementsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException when no metric is provided', async () => {
      await expect(service.create('u1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create a measurement when weightKg is provided', async () => {
      const created = { id: 'm1', userId: 'u1', weightKg: 85.2 };
      mockPrismaService.bodyMeasurement.create.mockResolvedValue(created);

      const result = await service.create('u1', { weightKg: 85.2 });

      expect(mockPrismaService.bodyMeasurement.create).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should return paginated data with date filters', async () => {
      const rows = [{ id: 'm1', weightKg: 80 }];
      mockPrismaService.$transaction.mockResolvedValue([rows, 1]);

      const result = await service.findAll('u1', {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-03-01T00:00:00.000Z',
        page: '1',
        limit: '10',
      });

      expect(result.data).toEqual(rows);
      expect(result.meta.total).toBe(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('latest', () => {
    it('should return the latest non-null value per metric', async () => {
      mockPrismaService.bodyMeasurement.findMany.mockResolvedValue([
        {
          date: new Date('2026-06-01'),
          weightKg: 82,
          bodyFatPct: null,
          waistCm: 85,
          chestCm: null,
          armCm: null,
          legCm: null,
          hipCm: null,
        },
        {
          date: new Date('2026-05-01'),
          weightKg: 84,
          bodyFatPct: 20,
          waistCm: null,
          chestCm: null,
          armCm: null,
          legCm: null,
          hipCm: null,
        },
      ]);

      const result = await service.latest('u1');

      expect(result.weightKg).toEqual({
        value: 82,
        date: new Date('2026-06-01'),
      });
      expect(result.bodyFatPct).toEqual({
        value: 20,
        date: new Date('2026-05-01'),
      });
      expect(result.waistCm).toEqual({
        value: 85,
        date: new Date('2026-06-01'),
      });
      expect(result.chestCm).toBeNull();
    });
  });

  describe('remove', () => {
    it('should throw ForbiddenException when measurement does not exist', async () => {
      mockPrismaService.bodyMeasurement.findFirst.mockResolvedValue(null);

      await expect(service.remove('u1', 'm1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete measurement when owned by user', async () => {
      mockPrismaService.bodyMeasurement.findFirst.mockResolvedValue({
        id: 'm1',
        userId: 'u1',
      });

      await service.remove('u1', 'm1');

      expect(mockPrismaService.bodyMeasurement.delete).toHaveBeenCalledWith({
        where: { id: 'm1' },
      });
    });
  });
});
