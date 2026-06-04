import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const mockReq = {
    user: { id: 'u1', email: 'a@b.com', role: 'USER' },
  };

  const mockService = {
    registerToken: jest.fn(),
    unregisterToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('register delegates to service', async () => {
    const dto = { token: 'x'.repeat(25), platform: 'ios' as const };
    mockService.registerToken.mockResolvedValue({ ok: true });

    await controller.register(mockReq as any, dto);

    expect(mockService.registerToken).toHaveBeenCalledWith('u1', dto);
  });

  it('unregister delegates to service', async () => {
    await controller.unregister(mockReq as any, { token: 'x'.repeat(25) });

    expect(mockService.unregisterToken).toHaveBeenCalledWith(
      'u1',
      'x'.repeat(25),
    );
  });
});
