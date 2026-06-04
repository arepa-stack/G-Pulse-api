import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';

describe('RoutinesService', () => {
  let service: RoutinesService;

  const mockTransaction = jest.fn();

  const mockPrismaService = {
    routine: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    exercise: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    routineExercise: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    userFavorite: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: mockTransaction,
    $queryRaw: jest.fn(),
  };

  const mockGeminiService = {
    generateRoutineJson: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutinesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: GeminiService,
          useValue: mockGeminiService,
        },
      ],
    }).compile();

    service = module.get<RoutinesService>(RoutinesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // createRoutine
  // -------------------------------------------------------------------------
  describe('createRoutine', () => {
    it('should throw if name or userId are missing', async () => {
      await expect(
        service.createRoutine({ name: 'Only Name' }),
      ).rejects.toThrow(HttpException);
      await expect(service.createRoutine({ userId: 'u1' })).rejects.toThrow(
        HttpException,
      );
    });

    it('should create a routine using manual exercises (without AI)', async () => {
      const data = {
        name: 'My Routine',
        userId: 'u1',
        description: 'Test',
        isPublic: false,
        exercises: [{ exerciseName: 'Push Up', sets: 3, reps: 10 }],
      };

      const mockRoutine = { id: 'r1', name: 'My Routine' };
      const mockExercise = { id: 'e1', name: 'Push Up' };
      const mockResult = { id: 'r1', exercises: [{ exercise: mockExercise }] };

      mockPrismaService.routine.create.mockResolvedValue(mockRoutine);
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: mockExercise.id }]);
      mockPrismaService.exercise.findUnique.mockResolvedValue(mockExercise);
      mockPrismaService.routineExercise.create.mockResolvedValue(true);
      mockPrismaService.routine.findUnique.mockResolvedValue(mockResult);

      const result = await service.createRoutine(data);

      expect(mockGeminiService.generateRoutineJson).not.toHaveBeenCalled();
      expect(mockPrismaService.routine.create).toHaveBeenCalledWith({
        data: {
          name: 'My Routine',
          description: 'Test',
          isPublic: false,
          creatorId: 'u1',
        },
      });
      expect(mockPrismaService.routineExercise.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          routineId: 'r1',
          exerciseId: 'e1',
          sets: 3,
          reps: 10,
        }),
      });
      expect(result).toEqual(mockResult);
    });

    it('should call Gemini if fromAi is true and create missing exercises', async () => {
      const data = {
        name: 'AI Routine',
        userId: 'u1',
        fromAi: true,
        aiPrompt: 'Make me strong',
      };

      const aiResponse = {
        exercises: [{ exerciseName: 'New AI Exercise', sets: 4, reps: 12 }],
      };

      const mockRoutine = { id: 'r2', name: 'AI Routine' };
      const newEx = { id: 'e2', name: 'New AI Exercise' };

      mockGeminiService.generateRoutineJson.mockResolvedValue(aiResponse);
      mockPrismaService.routine.create.mockResolvedValue(mockRoutine);
      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockPrismaService.exercise.create.mockResolvedValue(newEx);
      mockPrismaService.routine.findUnique.mockResolvedValue(mockRoutine);

      const result = await service.createRoutine(data);

      expect(mockGeminiService.generateRoutineJson).toHaveBeenCalledWith(
        'Make me strong',
      );
      expect(mockPrismaService.exercise.create).toHaveBeenCalledWith({
        data: {
          name: { en: 'New AI Exercise' },
          description: { en: 'AI Generated' },
        },
      });
      expect(result).toEqual(mockRoutine);
    });
  });

  // -------------------------------------------------------------------------
  // findAllForUser
  // -------------------------------------------------------------------------
  describe('findAllForUser', () => {
    it('should return paginated routines filtered by creatorId', async () => {
      const routines = [{ id: 'r1' }, { id: 'r2' }];
      mockTransaction.mockResolvedValue([routines, 2]);

      const result = await service.findAllForUser('u1', {
        page: '1',
        limit: '10',
      });

      expect(result.data).toEqual(routines);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply search filter when provided', async () => {
      mockTransaction.mockResolvedValue([[], 0]);

      await service.findAllForUser('u1', { search: 'push' });

      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // findOneForUser
  // -------------------------------------------------------------------------
  describe('findOneForUser', () => {
    it('should return the routine when owned by user', async () => {
      const routine = { id: 'r1', creatorId: 'u1', isPublic: false };
      mockPrismaService.routine.findUnique.mockResolvedValue(routine);

      const result = await service.findOneForUser('u1', 'r1');

      expect(result).toEqual(routine);
    });

    it('should return a public routine owned by another user', async () => {
      const routine = { id: 'r2', creatorId: 'other', isPublic: true };
      mockPrismaService.routine.findUnique.mockResolvedValue(routine);

      const result = await service.findOneForUser('u1', 'r2');

      expect(result).toEqual(routine);
    });

    it('should throw NotFoundException for a private routine owned by another user', async () => {
      const routine = { id: 'r3', creatorId: 'other', isPublic: false };
      mockPrismaService.routine.findUnique.mockResolvedValue(routine);

      await expect(service.findOneForUser('u1', 'r3')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when routine does not exist', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue(null);

      await expect(service.findOneForUser('u1', 'not-found')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateForUser
  // -------------------------------------------------------------------------
  describe('updateForUser', () => {
    it('should throw NotFoundException when routine is not owned by user', async () => {
      mockPrismaService.routine.findFirst.mockResolvedValue(null);

      await expect(
        service.updateForUser('u1', 'r-other', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update the routine within a transaction', async () => {
      const owned = { id: 'r1' };
      const updated = { id: 'r1', name: 'Updated' };

      mockPrismaService.routine.findFirst.mockResolvedValue(owned);
      mockTransaction.mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            routineExercise: { deleteMany: jest.fn(), create: jest.fn() },
            exercise: { findUnique: jest.fn().mockResolvedValue({ id: 'e1' }) },
            routine: { update: jest.fn().mockResolvedValue(updated) },
            $queryRaw: jest.fn().mockResolvedValue([{ id: 'e1' }]),
          };
          return fn(tx);
        },
      );

      const result = await service.updateForUser('u1', 'r1', {
        name: 'Updated',
      });

      expect(result).toEqual(updated);
    });
  });

  // -------------------------------------------------------------------------
  // removeForUser
  // -------------------------------------------------------------------------
  describe('removeForUser', () => {
    it('should throw NotFoundException when routine is not owned by user', async () => {
      mockPrismaService.routine.findFirst.mockResolvedValue(null);

      await expect(service.removeForUser('u1', 'r-other')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete exercises, favorites and routine in a transaction', async () => {
      const owned = { id: 'r1' };
      mockPrismaService.routine.findFirst.mockResolvedValue(owned);
      mockTransaction.mockResolvedValue([undefined, undefined, undefined]);

      await service.removeForUser('u1', 'r1');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.routineExercise.deleteMany).toHaveBeenCalledWith(
        { where: { routineId: 'r1' } },
      );
      expect(mockPrismaService.userFavorite.deleteMany).toHaveBeenCalledWith({
        where: { routineId: 'r1' },
      });
      expect(mockPrismaService.routine.delete).toHaveBeenCalledWith({
        where: { id: 'r1' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // like
  // -------------------------------------------------------------------------
  describe('like', () => {
    it('should throw NotFoundException when routine does not exist', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue(null);

      await expect(service.like('u1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when liking a private routine', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue({
        isPublic: false,
      });

      await expect(service.like('u1', 'r1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should increment likes on the first like of a public routine', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue({
        isPublic: true,
      });
      const txCreateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txUpdate = jest.fn();
      mockTransaction.mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            routineLike: { createMany: txCreateMany },
            routine: { update: txUpdate, updateMany: jest.fn() },
          }),
      );

      await service.like('u1', 'r1');

      expect(txCreateMany).toHaveBeenCalledWith({
        data: [{ userId: 'u1', routineId: 'r1' }],
        skipDuplicates: true,
      });
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { likes: { increment: 1 } },
      });
    });

    it('should NOT increment likes on a duplicate like', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue({
        isPublic: true,
      });
      const txUpdate = jest.fn();
      mockTransaction.mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            routineLike: {
              createMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            routine: { update: txUpdate, updateMany: jest.fn() },
          }),
      );

      await service.like('u1', 'r1');

      expect(txUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // unlike
  // -------------------------------------------------------------------------
  describe('unlike', () => {
    it('should decrement likes when removing an existing like', async () => {
      const txUpdate = jest.fn();
      const txUpdateMany = jest.fn();
      mockTransaction.mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            routineLike: {
              deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            routine: { update: txUpdate, updateMany: txUpdateMany },
          }),
      );

      await service.unlike('u1', 'r1');

      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { likes: { decrement: 1 } },
      });
    });

    it('should NOT decrement likes when there was no previous like', async () => {
      const txUpdate = jest.fn();
      mockTransaction.mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            routineLike: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            routine: { update: txUpdate, updateMany: jest.fn() },
          }),
      );

      await service.unlike('u1', 'r1');

      expect(txUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // favorite
  // -------------------------------------------------------------------------
  describe('favorite', () => {
    it('should throw NotFoundException when routine does not exist', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue(null);

      await expect(service.favorite('u1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when favoriting a private routine', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue({
        isPublic: false,
      });

      await expect(service.favorite('u1', 'r1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should call createMany on userFavorite', async () => {
      mockPrismaService.routine.findUnique.mockResolvedValue({
        isPublic: true,
      });
      const txCreateMany = jest.fn();
      mockTransaction.mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            userFavorite: { createMany: txCreateMany },
          }),
      );

      await service.favorite('u1', 'r1');

      expect(txCreateMany).toHaveBeenCalledWith({
        data: [{ userId: 'u1', routineId: 'r1' }],
        skipDuplicates: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // unfavorite
  // -------------------------------------------------------------------------
  describe('unfavorite', () => {
    it('should call deleteMany on userFavorite', async () => {
      const txDeleteMany = jest.fn();
      mockTransaction.mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            userFavorite: { deleteMany: txDeleteMany },
          }),
      );

      await service.unfavorite('u1', 'r1');

      expect(txDeleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', routineId: 'r1' },
      });
    });
  });
});
