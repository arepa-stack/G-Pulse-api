import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FeedService', () => {
  let service: FeedService;
  const mockFindMany = jest.fn();
  const mockCount = jest.fn();
  const mockTransaction = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        {
          provide: PrismaService,
          useValue: {
            userFollow: { findMany: mockFindMany },
            routine: { findMany: mockFindMany, count: mockCount },
            exerciseMedia: { findMany: mockFindMany, count: mockCount },
            $transaction: mockTransaction,
          },
        },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFeed', () => {
    it('should prioritize followed content before popular content', async () => {
      const followedDate = new Date('2026-06-10T12:00:00Z');
      const popularDate = new Date('2026-06-09T12:00:00Z');

      mockFindMany
        .mockResolvedValueOnce([{ followingId: 'creator-1' }])
        .mockResolvedValueOnce([
          {
            id: 'routine-followed',
            name: 'Followed Routine',
            likes: 1,
            updatedAt: followedDate,
            creator: { id: 'creator-1', name: 'Coach' },
            _count: { exercises: 2 },
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'routine-popular',
            name: 'Popular Routine',
            likes: 99,
            updatedAt: popularDate,
            creator: { id: 'creator-2', name: 'Star' },
            _count: { exercises: 5 },
          },
        ])
        .mockResolvedValueOnce([]);

      mockTransaction.mockResolvedValue([1, 1]);

      const result = await service.getFeed('viewer-1', { page: '1', limit: '10' });

      expect(result.data[0]).toEqual({
        type: 'routine',
        data: expect.objectContaining({ id: 'routine-followed' }),
      });
      expect(result.data[1]).toEqual({
        type: 'routine',
        data: expect.objectContaining({ id: 'routine-popular' }),
      });
      expect(result.meta.total).toBe(2);
    });
  });
});
