import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrisma = {
    deviceToken: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('registerToken upserts device token', async () => {
    mockPrisma.deviceToken.upsert.mockResolvedValue({});

    const result = await service.registerToken('u1', {
      token: 'a'.repeat(30),
      platform: 'android',
    });

    expect(mockPrisma.deviceToken.upsert).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('unregisterToken deletes by user and token', async () => {
    await service.unregisterToken('u1', 'token-abc');

    expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', token: 'token-abc' },
    });
  });
});
