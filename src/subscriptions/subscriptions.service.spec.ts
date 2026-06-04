import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { SubscriptionPlan } from '@prisma/client';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  const mockPushService = {
    notifySubscriptionCanceled: jest.fn(),
  };

  const mockPrisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    subscription: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPushService },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatus', () => {
    it('returns BASIC default when no subscription row', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ plan: SubscriptionPlan.BASIC });

      const result = await service.getStatus('u1');

      expect(result).toEqual({
        plan: SubscriptionPlan.BASIC,
        isActive: false,
        startDate: null,
        endDate: null,
        daysRemaining: null,
      });
    });

    it('returns subscription fields and daysRemaining when active', async () => {
      const endDate = new Date(Date.now() + 5 * 86400000);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        plan: SubscriptionPlan.PRO,
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ plan: SubscriptionPlan.PRO });

      const result = await service.getStatus('u1');

      expect(result.plan).toBe(SubscriptionPlan.PRO);
      expect(result.isActive).toBe(true);
      expect(result.daysRemaining).toBeGreaterThanOrEqual(4);
      expect(result.daysRemaining).toBeLessThanOrEqual(6);
    });
  });

  describe('cancel', () => {
    it('returns idempotent message when no active subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        isActive: false,
      });

      const result = await service.cancel('u1');

      expect(result.message).toBe('No active subscription to cancel');
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('deactivates subscription and notifies push', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        isActive: true,
        endDate: new Date(Date.now() + 86400000),
      });
      mockPrisma.subscription.update.mockResolvedValue({});

      const result = await service.cancel('u1');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { isActive: false, endDate: expect.any(Date) },
      });
      expect(mockPushService.notifySubscriptionCanceled).toHaveBeenCalledWith(
        'u1',
        0,
      );
      expect(result.message).toContain('Subscription canceled');
    });
  });
});
