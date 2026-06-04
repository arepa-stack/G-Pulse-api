import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RoutinesController } from './routines.controller';
import { RoutinesService } from './routines.service';
import { FindAllRoutinesDto } from './dto/find-all-routines.dto';
import { UpdateRoutineDto } from './dto/update-routine.dto';
import { CreateRoutineDto } from './dto/create-routine.dto';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };
const mockReq: AuthRequest = { user: mockUser };

describe('RoutinesController', () => {
  let controller: RoutinesController;

  const mockService = {
    createRoutine: jest.fn(),
    findAllForUser: jest.fn(),
    findOneForUser: jest.fn(),
    updateForUser: jest.fn(),
    removeForUser: jest.fn(),
    getToday: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutinesController],
      providers: [
        {
          provide: RoutinesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<RoutinesController>(RoutinesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createRoutine', () => {
    it('should call service with userId from req.user', async () => {
      const dto: Partial<CreateRoutineDto> = { name: 'My Routine' };
      const created = { id: 'r1', name: 'My Routine' };
      mockService.createRoutine.mockResolvedValue(created);

      const result = await controller.createRoutine(
        mockReq,
        dto as CreateRoutineDto,
      );

      expect(mockService.createRoutine).toHaveBeenCalledWith({
        ...dto,
        userId: mockUser.id,
      });
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should call findAllForUser with userId and query', async () => {
      const query: FindAllRoutinesDto = { page: '1', limit: '10' };
      const response = { data: [], meta: { total: 0 } };
      mockService.findAllForUser.mockResolvedValue(response);

      const result = await controller.findAll(mockReq, query);

      expect(mockService.findAllForUser).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
      expect(result).toEqual(response);
    });
  });

  describe('getToday', () => {
    it('should call getToday with userId from request', async () => {
      const routine = { id: 'r1', name: 'Today Routine' };
      mockService.getToday.mockResolvedValue(routine);

      const result = await controller.getToday(mockReq);

      expect(mockService.getToday).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(routine);
    });
  });

  describe('findOne', () => {
    it('should call findOneForUser with userId and id', async () => {
      const routine = { id: 'r1', name: 'Test' };
      mockService.findOneForUser.mockResolvedValue(routine);

      const result = await controller.findOne(mockReq, 'r1');

      expect(mockService.findOneForUser).toHaveBeenCalledWith(
        mockUser.id,
        'r1',
      );
      expect(result).toEqual(routine);
    });

    it('should propagate NotFoundException from service', async () => {
      mockService.findOneForUser.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(mockReq, 'r-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should call updateForUser with userId, id and dto', async () => {
      const dto: UpdateRoutineDto = { name: 'Updated' };
      const updated = { id: 'r1', name: 'Updated' };
      mockService.updateForUser.mockResolvedValue(updated);

      const result = await controller.update(mockReq, 'r1', dto);

      expect(mockService.updateForUser).toHaveBeenCalledWith(
        mockUser.id,
        'r1',
        dto,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should call removeForUser with userId and id', async () => {
      mockService.removeForUser.mockResolvedValue(undefined);

      await controller.remove(mockReq, 'r1');

      expect(mockService.removeForUser).toHaveBeenCalledWith(mockUser.id, 'r1');
    });

    it('should propagate NotFoundException for non-owned routines', async () => {
      mockService.removeForUser.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(mockReq, 'r-other')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
