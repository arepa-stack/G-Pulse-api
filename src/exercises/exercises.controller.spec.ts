import { Test, TestingModule } from '@nestjs/testing';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { FindAllExercisesDto } from './dto/find-all-exercises.dto';

describe('ExercisesController', () => {
  let controller: ExercisesController;
  let service: ExercisesService;

  const mockExercisesService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExercisesController],
      providers: [
        {
          provide: ExercisesService,
          useValue: mockExercisesService,
        },
      ],
    }).compile();

    controller = module.get<ExercisesController>(ExercisesController);
    service = module.get<ExercisesService>(ExercisesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with correct default pagination when no query params are provided', async () => {
      const mockResult = [{ id: '1', name: 'Push Up' }];
      mockExercisesService.findAll.mockResolvedValue(mockResult);

      const query: FindAllExercisesDto = {};
      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        where: {},
      });
      expect(result).toEqual(mockResult);
    });

    it('should correctly parse limit and page from query and pass filters', async () => {
      const mockResult = [{ id: '2', name: 'Squat' }];
      mockExercisesService.findAll.mockResolvedValue(mockResult);

      const query: FindAllExercisesDto = {
        muscle: 'legs',
        difficulty: 'hard',
        limit: '10',
        page: '2',
        search: 'squat',
      };

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith({
        skip: 10, // (2 - 1) * 10
        take: 10,
        where: {
          difficulty: 'hard',
          OR: [
            { primaryMuscles: { some: { name: 'legs' } } },
            { secondaryMuscles: { some: { name: 'legs' } } },
          ],
          name: { contains: 'squat', mode: 'insensitive' },
        },
      });
      expect(result).toEqual(mockResult);
    });
  });
});
