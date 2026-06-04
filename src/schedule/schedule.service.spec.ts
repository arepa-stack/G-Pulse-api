import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ScheduleService', () => {
  let service: ScheduleService;

  const mockPrismaService = {
    routine: {
      findUnique: jest.fn(),
    },
    routineSchedule: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsert', () => {
    it('should throw NotFoundException if routine does not exist', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue(null);

      await expect(
        service.upsert('u1', { routineId: 'r1', dayOfWeek: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if routine is private and belongs to someone else', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue({
        creatorId: 'u2',
        isPublic: false,
      });

      await expect(
        service.upsert('u1', { routineId: 'r1', dayOfWeek: 1 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should upsert schedule successfully if routine belongs to the user', async () => {
      const routine = { creatorId: 'u1', isPublic: false };
      mockPrismaService.routine.findUnique.mockResolvedValue(routine);

      const expectedResult = {
        userId: 'u1',
        routineId: 'r1',
        dayOfWeek: 1,
        enabled: true,
      };
      mockPrismaService.routineSchedule.upsert.mockResolvedValue(expectedResult);

      const result = await service.upsert('u1', {
        routineId: 'r1',
        dayOfWeek: 1,
      });

      expect(mockPrismaService.routineSchedule.upsert).toHaveBeenCalledWith({
        where: {
          userId_dayOfWeek: {
            userId: 'u1',
            dayOfWeek: 1,
          },
        },
        create: {
          userId: 'u1',
          dayOfWeek: 1,
          routineId: 'r1',
          enabled: true,
        },
        update: {
          routineId: 'r1',
          enabled: true,
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
      expect(result).toEqual(expectedResult);
    });

    it('should upsert schedule successfully if routine is public but belongs to someone else', async () => {
      const routine = { creatorId: 'u2', isPublic: true };
      mockPrismaService.routine.findUnique.mockResolvedValue(routine);

      const expectedResult = {
        userId: 'u1',
        routineId: 'r1',
        dayOfWeek: 1,
        enabled: true,
      };
      mockPrismaService.routineSchedule.upsert.mockResolvedValue(expectedResult);

      const result = await service.upsert('u1', {
        routineId: 'r1',
        dayOfWeek: 1,
      });

      expect(result).toEqual(expectedResult);
    });
  });

  describe('list', () => {
    it('should return 7 days mapping with schedules where present and null elsewhere', async () => {
      const dbSchedules = [
        {
          dayOfWeek: 1,
          enabled: true,
          routine: { id: 'r1', name: 'Push', _count: { exercises: 3 } },
        },
        {
          dayOfWeek: 3,
          enabled: false,
          routine: { id: 'r2', name: 'Pull', _count: { exercises: 4 } },
        },
      ];
      mockPrismaService.routineSchedule.findMany.mockResolvedValue(dbSchedules);

      const result = await service.list('u1');

      expect(result).toHaveLength(7);
      expect(result[0]).toEqual({ dayOfWeek: 0, routine: null, enabled: false });
      expect(result[1]).toEqual({
        dayOfWeek: 1,
        routine: { id: 'r1', name: 'Push', _count: { exercises: 3 } },
        enabled: true,
      });
      expect(result[2]).toEqual({ dayOfWeek: 2, routine: null, enabled: false });
      expect(result[3]).toEqual({
        dayOfWeek: 3,
        routine: { id: 'r2', name: 'Pull', _count: { exercises: 4 } },
        enabled: false,
      });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if entry to delete does not exist', async () => {
      mockPrismaService.routineSchedule.findUnique.mockResolvedValue(null);

      await expect(service.remove('u1', 1)).rejects.toThrow(NotFoundException);
    });

    it('should delete entry if it exists', async () => {
      mockPrismaService.routineSchedule.findUnique.mockResolvedValue({
        userId: 'u1',
        dayOfWeek: 1,
      });

      await service.remove('u1', 1);

      expect(mockPrismaService.routineSchedule.delete).toHaveBeenCalledWith({
        where: {
          userId_dayOfWeek: {
            userId: 'u1',
            dayOfWeek: 1,
          },
        },
      });
    });
  });
});
