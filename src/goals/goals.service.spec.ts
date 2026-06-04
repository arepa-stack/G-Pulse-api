import { Test, TestingModule } from '@nestjs/testing';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoalType, GoalStatus } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('GoalsService', () => {
  let service: GoalsService;

  const mockPrismaService = {
    goal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    activityLog: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a goal', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        type: GoalType.WEIGHT,
        targetValue: 75.0,
        currentValue: 0.0,
        status: GoalStatus.ACTIVE,
      };
      mockPrismaService.goal.create.mockResolvedValue(mockGoal);

      const result = await service.create('u1', {
        type: GoalType.WEIGHT,
        targetValue: 75.0,
      });

      expect(result).toEqual(mockGoal);
      expect(mockPrismaService.goal.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          type: GoalType.WEIGHT,
          targetValue: 75.0,
          endDate: null,
        },
      });
    });
  });

  describe('findAllForUser', () => {
    it('should return all goals for a user', async () => {
      const mockGoals = [
        { id: 'g1', userId: 'u1', type: GoalType.WEIGHT, currentValue: 0.0 },
      ];
      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);

      const result = await service.findAllForUser('u1');

      expect(result).toEqual(mockGoals);
      expect(mockPrismaService.goal.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOneForUser', () => {
    it('should return a goal if it belongs to the user', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        type: GoalType.WEIGHT,
        currentValue: 0.0,
      };
      mockPrismaService.goal.findUnique.mockResolvedValue(mockGoal);

      const result = await service.findOneForUser('u1', 'g1');

      expect(result).toEqual(mockGoal);
    });

    it('should throw NotFoundException if goal does not exist', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue(null);

      await expect(service.findOneForUser('u1', 'g-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if goal belongs to another user', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'other-user',
        type: GoalType.WEIGHT,
        currentValue: 0.0,
      };
      mockPrismaService.goal.findUnique.mockResolvedValue(mockGoal);

      await expect(service.findOneForUser('u1', 'g1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateForUser', () => {
    it('should update and return the goal', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        type: GoalType.WEIGHT,
        currentValue: 78.0,
      };
      mockPrismaService.goal.findUnique.mockResolvedValue(mockGoal);
      mockPrismaService.goal.update.mockResolvedValue({
        ...mockGoal,
        currentValue: 75.0,
      });

      const result = await service.updateForUser('u1', 'g1', {
        currentValue: 75.0,
      });

      expect(result.currentValue).toBe(75.0);
    });
  });

  describe('removeForUser', () => {
    it('should delete the goal', async () => {
      const mockGoal = { id: 'g1', userId: 'u1', type: GoalType.WEIGHT };
      mockPrismaService.goal.findUnique.mockResolvedValue(mockGoal);
      mockPrismaService.goal.delete.mockResolvedValue(mockGoal);

      await service.removeForUser('u1', 'g1');

      expect(mockPrismaService.goal.delete).toHaveBeenCalledWith({
        where: { id: 'g1' },
      });
    });
  });

  describe('populateGoalProgress', () => {
    it('should calculate WORKOUTS_PER_WEEK progress dynamically from ActivityLog', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        type: GoalType.WORKOUTS_PER_WEEK,
        targetValue: 4.0,
        currentValue: 0.0,
      };
      mockPrismaService.goal.create.mockResolvedValue(mockGoal);
      mockPrismaService.activityLog.count.mockResolvedValue(3);

      const result = await service.create('u1', {
        type: GoalType.WORKOUTS_PER_WEEK,
        targetValue: 4.0,
      });

      expect(result.currentValue).toBe(3);
    });

    it('should calculate CALORIES_BURN progress dynamically from ActivityLog', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        type: GoalType.CALORIES_BURN,
        targetValue: 2000.0,
        currentValue: 0.0,
      };
      mockPrismaService.goal.create.mockResolvedValue(mockGoal);
      mockPrismaService.activityLog.aggregate.mockResolvedValue({
        _sum: { calories: 1500 },
      });

      const result = await service.create('u1', {
        type: GoalType.CALORIES_BURN,
        targetValue: 2000.0,
      });

      expect(result.currentValue).toBe(1500);
    });

    it('should calculate DURATION_MINUTES progress dynamically from ActivityLog', async () => {
      const mockGoal = {
        id: 'g1',
        userId: 'u1',
        type: GoalType.DURATION_MINUTES,
        targetValue: 180.0,
        currentValue: 0.0,
      };
      mockPrismaService.goal.create.mockResolvedValue(mockGoal);
      mockPrismaService.activityLog.aggregate.mockResolvedValue({
        _sum: { duration: 120 },
      });

      const result = await service.create('u1', {
        type: GoalType.DURATION_MINUTES,
        targetValue: 180.0,
      });

      expect(result.currentValue).toBe(120);
    });
  });
});
