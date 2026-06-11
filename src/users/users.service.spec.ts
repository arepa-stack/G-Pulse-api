import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

describe('UsersService', () => {
  let service: UsersService;
  const mockTransaction = jest.fn();
  const mockFindMany = jest.fn();
  const mockCount = jest.fn();
  const mockFindFirst = jest.fn();
  const mockFindUnique = jest.fn();
  const mockUpdate = jest.fn();
  const mockCreateMany = jest.fn();
  const mockDeleteMany = jest.fn();
  const mockUploadFile = jest.fn();
  const mockDeleteFileByUrl = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: mockFindUnique,
              findFirst: mockFindFirst,
              update: mockUpdate,
            },
            userFavorite: {
              findMany: mockFindMany,
              count: mockCount,
            },
            userFollow: {
              count: mockCount,
              findUnique: jest.fn(),
              findMany: mockFindMany,
              createMany: mockCreateMany,
              deleteMany: mockDeleteMany,
            },
            routine: {
              count: mockCount,
              findMany: mockFindMany,
            },
            exerciseMedia: {
              aggregate: jest.fn(),
            },
            $transaction: mockTransaction,
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadFile: mockUploadFile,
            deleteFileByUrl: mockDeleteFileByUrl,
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

  describe('update', () => {
    it('should throw ConflictException when username is already taken', async () => {
      mockFindFirst.mockResolvedValue({ id: 'other-user' });

      await expect(
        service.update('user-1', { username: 'taken_name' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update profile when username is available', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockUpdate.mockResolvedValue({ id: 'user-1', username: 'new_name' });

      const result = await service.update('user-1', { username: 'new_name' });

      expect(result.username).toBe('new_name');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { username: 'new_name' },
      });
    });
  });

  describe('getPublicProfile', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockFindFirst.mockResolvedValue(null);

      await expect(service.getPublicProfile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return public profile with stats', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'user-1',
        name: 'John',
        username: 'john_fit',
        avatarUrl: null,
        bio: 'Coach',
        level: 'BEGINNER',
        createdAt: new Date(),
      });
      mockTransaction.mockResolvedValue([
        10,
        5,
        3,
        { _sum: { likes: 42 } },
        [],
        false,
      ]);

      const result = await service.getPublicProfile('john_fit', 'viewer-1');

      expect(result.stats.followersCount).toBe(10);
      expect(result.stats.followingCount).toBe(5);
      expect(result.stats.publicRoutinesCount).toBe(3);
      expect(result.stats.mediaLikesReceived).toBe(42);
      expect(result.isFollowedByViewer).toBe(false);
    });
  });

  describe('follow', () => {
    it('should prevent self-follow', async () => {
      await expect(service.follow('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when target user does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(service.follow('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create follow relation idempotently', async () => {
      mockFindUnique.mockResolvedValue({ id: 'user-2' });
      mockCreateMany.mockResolvedValue({ count: 1 });

      await service.follow('user-1', 'user-2');

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [{ followerId: 'user-1', followingId: 'user-2' }],
        skipDuplicates: true,
      });
    });
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
