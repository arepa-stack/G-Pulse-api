import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExerciseImagesService } from './exercise-images.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

describe('ExerciseImagesService', () => {
  let service: ExerciseImagesService;
  const mockTransaction = jest.fn();
  const mockFindUnique = jest.fn();
  const mockFindMany = jest.fn();
  const mockCount = jest.fn();
  const mockCreate = jest.fn();
  const mockUpdate = jest.fn();
  const mockUpdateMany = jest.fn();
  const mockCreateMany = jest.fn();
  const mockDeleteMany = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExerciseImagesService,
        {
          provide: PrismaService,
          useValue: {
            exercise: { findUnique: jest.fn() },
            exerciseMedia: {
              findUnique: mockFindUnique,
              findMany: mockFindMany,
              count: mockCount,
              create: mockCreate,
              update: mockUpdate,
              updateMany: mockUpdateMany,
            },
            mediaLike: {
              createMany: mockCreateMany,
              deleteMany: mockDeleteMany,
            },
            $transaction: mockTransaction,
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadFile: jest.fn(),
            deleteFileByUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ExerciseImagesService>(ExerciseImagesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('like', () => {
    it('should throw ForbiddenException for private media', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'media-1',
        isPublic: false,
        isPaused: false,
      });

      await expect(service.like('user-1', 'media-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should increment likes only on first like', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'media-1',
        isPublic: true,
        isPaused: false,
      });
      mockTransaction.mockImplementation(async (cb) =>
        cb({
          mediaLike: {
            createMany: mockCreateMany.mockResolvedValue({ count: 1 }),
          },
          exerciseMedia: { update: mockUpdate },
        }),
      );

      await service.like('user-1', 'media-1');

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [{ userId: 'user-1', mediaId: 'media-1' }],
        skipDuplicates: true,
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { likes: { increment: 1 } },
      });
    });
  });

  describe('getPublicMediaByUser', () => {
    it('should return paginated public media', async () => {
      const media = [{ id: 'media-1', url: 'https://example.com/video.mp4' }];
      mockTransaction.mockResolvedValue([media, 1]);

      const result = await service.getPublicMediaByUser('user-1', {
        page: '1',
        limit: '10',
      });

      expect(result.data).toEqual(media);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('unlike', () => {
    it('should decrement likes when removing an existing like', async () => {
      mockTransaction.mockImplementation(async (cb) =>
        cb({
          mediaLike: {
            deleteMany: mockDeleteMany.mockResolvedValue({ count: 1 }),
          },
          exerciseMedia: {
            update: mockUpdate,
            updateMany: mockUpdateMany,
          },
        }),
      );

      await service.unlike('user-1', 'media-1');

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', mediaId: 'media-1' },
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { likes: { decrement: 1 } },
      });
    });
  });
});
