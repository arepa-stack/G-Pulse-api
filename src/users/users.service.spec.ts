import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  const mockTransaction = jest.fn();
  const mockFindMany = jest.fn();
  const mockCount = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), update: jest.fn() },
            userFavorite: {
              findMany: mockFindMany,
              count: mockCount,
            },
            $transaction: mockTransaction,
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFavorites', () => {
    it('should return paginated favorites mapping the routine objects directly', async () => {
      const mockFavs = [
        {
          userId: 'user-1',
          routineId: 'routine-1',
          routine: {
            id: 'routine-1',
            name: 'My Routine',
            creator: { id: 'creator-1', name: 'Creator' },
          },
        },
      ];
      mockTransaction.mockResolvedValue([mockFavs, 1]);

      const result = await service.getFavorites('user-1', {
        page: '1',
        limit: '10',
      });

      expect(result.data).toEqual([
        {
          id: 'routine-1',
          name: 'My Routine',
          creator: { id: 'creator-1', name: 'Creator' },
        },
      ]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(mockTransaction).toHaveBeenCalled();
    });
  });
});
