import { Test, TestingModule } from '@nestjs/testing';
import { ExercisesService } from './exercises.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ExercisesService', () => {
  let service: ExercisesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        {
          provide: PrismaService,
          useValue: {
            exercise: { findMany: jest.fn(), findUnique: jest.fn() }
          }
        }
      ],
    }).compile();

    service = module.get<ExercisesService>(ExercisesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
