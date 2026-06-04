import { Test, TestingModule } from '@nestjs/testing';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from '../auth/firebase-admin.service';

describe('PushService', () => {
  let service: PushService;
  const sendEachForMulticast = jest.fn();

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    deviceToken: { deleteMany: jest.fn() },
  };

  const mockFirebase = {
    getMessaging: jest.fn(() => ({ sendEachForMulticast })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FirebaseAdminService, useValue: mockFirebase },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
  });

  afterEach(() => jest.clearAllMocks());

  it('does not call FCM when pushEnabled is false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      pushEnabled: false,
      deviceTokens: [{ token: 't1' }],
    });

    await service.sendToUser('u1', { title: 'Hi', body: 'Test' });

    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends multicast when user has tokens and push enabled', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      pushEnabled: true,
      deviceTokens: [{ token: 't1' }, { token: 't2' }],
    });
    sendEachForMulticast.mockResolvedValue({
      responses: [{ success: true }, { success: true }],
    });

    await service.sendToUser('u1', { title: 'Hi', body: 'Test' });

    expect(sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['t1', 't2'],
        notification: { title: 'Hi', body: 'Test' },
      }),
    );
  });

  it('deletes invalid tokens from database', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      pushEnabled: true,
      deviceTokens: [{ token: 'bad' }],
    });
    sendEachForMulticast.mockResolvedValue({
      responses: [
        {
          success: false,
          error: { code: 'messaging/invalid-registration-token' },
        },
      ],
    });

    await service.sendToUser('u1', { title: 'Hi', body: 'Test' });

    expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['bad'] } },
    });
  });
});
