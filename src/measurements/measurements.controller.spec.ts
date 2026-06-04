import { Test, TestingModule } from '@nestjs/testing';
import { MeasurementsController } from './measurements.controller';
import { MeasurementsService } from './measurements.service';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

describe('MeasurementsController', () => {
  let controller: MeasurementsController;

  const mockReq: AuthRequest = {
    user: { id: 'user-1', email: 'test@test.com', role: 'USER' },
  };

  const mockMeasurementsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    latest: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeasurementsController],
      providers: [
        {
          provide: MeasurementsService,
          useValue: mockMeasurementsService,
        },
      ],
    }).compile();

    controller = module.get<MeasurementsController>(MeasurementsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should delegate to service', async () => {
    const dto = { weightKg: 80 };
    const expected = { id: 'm1', weightKg: 80 };
    mockMeasurementsService.create.mockResolvedValue(expected);

    const result = await controller.create(mockReq, dto);

    expect(mockMeasurementsService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual(expected);
  });

  it('findAll should delegate to service', async () => {
    const query = { page: '1' };
    const expected = { data: [], meta: { total: 0 } };
    mockMeasurementsService.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(mockReq, query);

    expect(mockMeasurementsService.findAll).toHaveBeenCalledWith(
      'user-1',
      query,
    );
    expect(result).toEqual(expected);
  });

  it('latest should delegate to service', async () => {
    const expected = { weightKg: null };
    mockMeasurementsService.latest.mockResolvedValue(expected);

    const result = await controller.latest(mockReq);

    expect(mockMeasurementsService.latest).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(expected);
  });

  it('remove should delegate to service', async () => {
    await controller.remove(mockReq, 'm1');

    expect(mockMeasurementsService.remove).toHaveBeenCalledWith(
      'user-1',
      'm1',
    );
  });
});
