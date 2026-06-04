import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

describe('ScheduleController', () => {
  let controller: ScheduleController;

  const mockScheduleService = {
    upsert: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'u1', email: 'test@example.com', role: 'USER' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduleController],
      providers: [
        {
          provide: ScheduleService,
          useValue: mockScheduleService,
        },
      ],
    }).compile();

    controller = module.get<ScheduleController>(ScheduleController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upsert', () => {
    it('should call service.upsert with user id and dto', async () => {
      const dto = { routineId: 'r1', dayOfWeek: 1, enabled: true };
      const expectedResult = { id: 's1', ...dto, userId: 'u1' };
      mockScheduleService.upsert.mockResolvedValue(expectedResult);

      const result = await controller.upsert(mockRequest as any, dto);

      expect(mockScheduleService.upsert).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('list', () => {
    it('should call service.list with user id', async () => {
      const expectedResult = [{ dayOfWeek: 0, routine: null, enabled: false }];
      mockScheduleService.list.mockResolvedValue(expectedResult);

      const result = await controller.list(mockRequest as any);

      expect(mockScheduleService.list).toHaveBeenCalledWith('u1');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should call service.remove with user id and dayOfWeek', async () => {
      mockScheduleService.remove.mockResolvedValue(undefined);

      await controller.remove(mockRequest as any, 1);

      expect(mockScheduleService.remove).toHaveBeenCalledWith('u1', 1);
    });
  });
});
