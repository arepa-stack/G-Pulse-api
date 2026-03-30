import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';

describe('RoutinesService', () => {
  let service: RoutinesService;
  let prismaService: PrismaService;
  let geminiService: GeminiService;

  const mockPrismaService = {
    routine: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    exercise: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    routineExercise: {
      create: jest.fn(),
    },
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
    prismaService = module.get<PrismaService>(PrismaService);
    geminiService = module.get<GeminiService>(GeminiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoutine', () => {
    it('should throw an error if name or userId are missing', async () => {
      await expect(service.createRoutine({ name: 'Only Name' })).rejects.toThrow(HttpException);
      await expect(service.createRoutine({ userId: 'u1' })).rejects.toThrow(HttpException);
    });

    it('should create a routine using manual exercises (without AI)', async () => {
      const data = {
        name: 'My Routine',
        userId: 'u1',
        description: 'Test',
        isPublic: false,
        exercises: [
          { exerciseName: 'Push Up', sets: 3, reps: 10 }
        ]
      };

      const mockRoutine = { id: 'r1', name: 'My Routine' };
      const mockExercise = { id: 'e1', name: 'Push Up' };
      const mockResult = { id: 'r1', exercises: [{ exercise: mockExercise }] };

      mockPrismaService.routine.create.mockResolvedValue(mockRoutine);
      mockPrismaService.exercise.findFirst.mockResolvedValue(mockExercise);
      mockPrismaService.routineExercise.create.mockResolvedValue(true);
      mockPrismaService.routine.findUnique.mockResolvedValue(mockResult);

      const result = await service.createRoutine(data);

      expect(mockGeminiService.generateRoutineJson).not.toHaveBeenCalled();
      expect(mockPrismaService.routine.create).toHaveBeenCalledWith({
        data: { name: 'My Routine', description: 'Test', isPublic: false, creatorId: 'u1' }
      });
      expect(mockPrismaService.routineExercise.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ routineId: 'r1', exerciseId: 'e1', sets: 3, reps: 10 })
      });
      expect(result).toEqual(mockResult);
    });

    it('should call Gemini if fromAi is true and prompt provided, and create missing exercises', async () => {
      const data = {
        name: 'AI Routine',
        userId: 'u1',
        fromAi: true,
        aiPrompt: 'Make me strong'
      };

      const aiResponse = {
        exercises: [
          { exerciseName: 'New AI Exercise', sets: 4, reps: 12 }
        ]
      };

      const mockRoutine = { id: 'r2', name: 'AI Routine' };
      const newEx = { id: 'e2', name: 'New AI Exercise' };

      mockGeminiService.generateRoutineJson.mockResolvedValue(aiResponse);
      mockPrismaService.routine.create.mockResolvedValue(mockRoutine);
      // Mock findFirst returning null to force branch of creating new exercise
      mockPrismaService.exercise.findFirst.mockResolvedValue(null);
      mockPrismaService.exercise.create.mockResolvedValue(newEx);
      mockPrismaService.routine.findUnique.mockResolvedValue(mockRoutine);

      const result = await service.createRoutine(data);

      expect(mockGeminiService.generateRoutineJson).toHaveBeenCalledWith('Make me strong');
      expect(mockPrismaService.exercise.create).toHaveBeenCalledWith({
        data: { name: 'New AI Exercise', description: 'AI Generated' }
      });
      expect(mockPrismaService.routineExercise.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ exerciseId: 'e2' })
      });
      expect(result).toEqual(mockRoutine);
    });
  });
});

