import { Test, TestingModule } from '@nestjs/testing';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalType } from '@prisma/client';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };
const mockReq: AuthRequest = { user: mockUser };

describe('GoalsController', () => {
  let controller: GoalsController;
  let service: GoalsService;

  const mockGoalsService = {
    create: jest.fn(),
    findAllForUser: jest.fn(),
    findOneForUser: jest.fn(),
    updateForUser: jest.fn(),
    removeForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [
        {
          provide: GoalsService,
          useValue: mockGoalsService,
        },
      ],
    }).compile();

    controller = module.get<GoalsController>(GoalsController);
    service = module.get<GoalsService>(GoalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with user id and dto', async () => {
      const dto: CreateGoalDto = { type: GoalType.WEIGHT, targetValue: 70 };
      const created = { id: 'g1', userId: mockUser.id, ...dto };
      mockGoalsService.create.mockResolvedValue(created);

      const result = await controller.create(mockReq, dto);

      expect(service.create).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should call service.findAllForUser with user id', async () => {
      const list = [{ id: 'g1', userId: mockUser.id }];
      mockGoalsService.findAllForUser.mockResolvedValue(list);

      const result = await controller.findAll(mockReq);

      expect(service.findAllForUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(list);
    });
  });

  describe('findOne', () => {
    it('should call service.findOneForUser with user id and id', async () => {
      const goal = { id: 'g1', userId: mockUser.id };
      mockGoalsService.findOneForUser.mockResolvedValue(goal);

      const result = await controller.findOne(mockReq, 'g1');

      expect(service.findOneForUser).toHaveBeenCalledWith(mockUser.id, 'g1');
      expect(result).toEqual(goal);
    });
  });

  describe('update', () => {
    it('should call service.updateForUser with user id, id, and dto', async () => {
      const dto: UpdateGoalDto = { targetValue: 68 };
      const updated = { id: 'g1', userId: mockUser.id, targetValue: 68 };
      mockGoalsService.updateForUser.mockResolvedValue(updated);

      const result = await controller.update(mockReq, 'g1', dto);

      expect(service.updateForUser).toHaveBeenCalledWith(mockUser.id, 'g1', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should call service.removeForUser with user id and id', async () => {
      mockGoalsService.removeForUser.mockResolvedValue(undefined);

      await controller.remove(mockReq, 'g1');

      expect(service.removeForUser).toHaveBeenCalledWith(mockUser.id, 'g1');
    });
  });
});
