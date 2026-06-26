import { Test, TestingModule } from '@nestjs/testing';
import { ProgressService } from './progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';

describe('ProgressService', () => {
  let service: ProgressService;

  const mockPushService = {
    sendToUserAsync: jest.fn(),
  };

  const mockPrisma = {
    activityLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: { findUnique: jest.fn(), update: jest.fn() },
    workoutSet: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPushService },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logActivity', () => {
    it('notifies streak milestone when reaching 7 days', async () => {
      mockPrisma.workoutSet.groupBy.mockResolvedValue([]);
      mockPrisma.activityLog.create.mockResolvedValue({ id: 'log1', sets: [] });
      mockPrisma.user.findUnique.mockResolvedValue({ trainingStreak: 6 });
      mockPrisma.activityLog.findFirst.mockResolvedValue({
        date: new Date(Date.now() - 86400000),
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.logActivity('u1', { date: new Date().toISOString() });

      expect(mockPushService.sendToUserAsync).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ data: expect.objectContaining({ type: 'streak' }) }),
      );
    });

    it('notifies PR when set beats previous max weight', async () => {
      mockPrisma.workoutSet.groupBy.mockResolvedValue([
        { exerciseId: 'ex1', _max: { weight: 80 } },
      ]);
      mockPrisma.activityLog.create.mockResolvedValue({
        id: 'log1',
        sets: [],
      });
      mockPrisma.user.findUnique.mockResolvedValue({ trainingStreak: 1 });
      mockPrisma.activityLog.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({});

      await service.logActivity('u1', {
        date: new Date().toISOString(),
        sets: [
          {
            exerciseId: 'ex1',
            setNumber: 1,
            reps: 5,
            weight: 100,
          },
        ],
      });

      expect(mockPushService.sendToUserAsync).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ data: expect.objectContaining({ type: 'pr' }) }),
      );
    });
  });

  describe('getExerciseStats', () => {
    it('returns zeroed stats when no sets', async () => {
      mockPrisma.workoutSet.findMany.mockResolvedValue([]);
      const stats = await service.getExerciseStats('u1', 'ex1');
      expect(stats).toMatchObject({
        timesPerformed: 0,
        totalSets: 0,
        maxWeight: null,
        estimatedOneRepMax: null,
      });
    });

    it('aggregates sets across sessions', async () => {
      const d1 = new Date('2026-01-01');
      const d2 = new Date('2026-01-03');
      mockPrisma.workoutSet.findMany.mockResolvedValue([
        { reps: 10, weight: 50, activityLogId: 'a1', activityLog: { date: d1 } },
        { reps: 8, weight: 60, activityLogId: 'a1', activityLog: { date: d1 } },
        { reps: 5, weight: 80, activityLogId: 'a2', activityLog: { date: d2 } },
      ]);

      const stats = await service.getExerciseStats('u1', 'ex1');

      expect(stats.timesPerformed).toBe(2); // 2 sesiones distintas
      expect(stats.totalSets).toBe(3);
      expect(stats.totalReps).toBe(23);
      expect(stats.maxWeight).toBe(80);
      expect(stats.maxReps).toBe(10);
      expect(stats.totalVolume).toBe(10 * 50 + 8 * 60 + 5 * 80); // 1380
      // Epley máx: 80*(1+5/30)=93.3
      expect(stats.estimatedOneRepMax).toBe(93.3);
      expect(stats.firstPerformedAt).toEqual(d1);
      expect(stats.lastPerformedAt).toEqual(d2);
    });
  });
});
