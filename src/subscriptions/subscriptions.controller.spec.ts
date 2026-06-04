import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;

  const mockReq = {
    user: { id: 'u1', email: 'a@b.com', role: 'USER' },
  };

  const mockService = {
    createSubscription: jest.fn(),
    getStatus: jest.fn(),
    cancel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getMine delegates to getStatus', async () => {
    const status = { plan: 'BASIC', isActive: false };
    mockService.getStatus.mockResolvedValue(status);

    const result = await controller.getMine(mockReq as any);

    expect(mockService.getStatus).toHaveBeenCalledWith('u1');
    expect(result).toEqual(status);
  });

  it('cancel delegates to service', async () => {
    const msg = { message: 'canceled' };
    mockService.cancel.mockResolvedValue(msg);

    const result = await controller.cancel(mockReq as any);

    expect(mockService.cancel).toHaveBeenCalledWith('u1');
    expect(result).toEqual(msg);
  });
});
