import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MediaType, Role } from '@prisma/client';
import { UploadExerciseMediaDto } from './dto/upload-exercise-media.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ExerciseImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async uploadMedia(
    userId: string,
    file: Express.Multer.File,
    dto: UploadExerciseMediaDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: dto.exerciseId },
    });
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${dto.exerciseId} not found`);
    }

    let mediaType: MediaType;
    if (file.mimetype === 'image/gif') {
      mediaType = MediaType.GIF;
    } else if (file.mimetype.startsWith('image/')) {
      mediaType = MediaType.IMAGE;
    } else if (file.mimetype.startsWith('video/')) {
      mediaType = MediaType.VIDEO;
    } else {
      throw new BadRequestException(
        'Invalid file type. Only images, GIFs, and videos are allowed.',
      );
    }

    const maxSizeBytes = 50 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File size exceeds the 50MB limit.');
    }

    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `exercise-images/${dto.exerciseId}/${Date.now()}_${sanitizedFilename}`;
    const publicUrl = await this.storageService.uploadFile(file, path);

    return this.prisma.exerciseMedia.create({
      data: {
        url: publicUrl,
        type: mediaType,
        exerciseId: dto.exerciseId,
        userId: userId,
        isPublic: dto.isPublic ?? false,
        isPaused: false,
        caption: dto.caption,
      },
      include: {
        exercise: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });
  }

  async getMyMediaByExercise(userId: string, exerciseId: string, q: PaginationDto) {
    const take = q.limit ? parseInt(q.limit) : 20;
    const skip = q.page ? (parseInt(q.page) - 1) * take : 0;

    const where = {
      userId,
      exerciseId,
      isPaused: false,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.exerciseMedia.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          exercise: {
            select: { id: true, name: true, thumbnail: true },
          },
        },
      }),
      this.prisma.exerciseMedia.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: q.page ? +q.page : 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getPublicMediaByUser(userId: string, q: PaginationDto) {
    const take = q.limit ? parseInt(q.limit) : 20;
    const skip = q.page ? (parseInt(q.page) - 1) * take : 0;

    const where = {
      userId,
      isPublic: true,
      isPaused: false,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.exerciseMedia.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          exercise: {
            select: { id: true, name: true, thumbnail: true },
          },
          user: {
            select: { id: true, name: true, username: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.exerciseMedia.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: q.page ? +q.page : 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  private async getPublicMediaOrThrow(mediaId: string) {
    const media = await this.prisma.exerciseMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, isPublic: true, isPaused: true },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }
    if (!media.isPublic || media.isPaused) {
      throw new ForbiddenException('Only public media can be liked');
    }

    return media;
  }

  async like(userId: string, mediaId: string) {
    await this.getPublicMediaOrThrow(mediaId);

    await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.mediaLike.createMany({
        data: [{ userId, mediaId }],
        skipDuplicates: true,
      });

      if (inserted.count === 1) {
        await tx.exerciseMedia.update({
          where: { id: mediaId },
          data: { likes: { increment: 1 } },
        });
      }
    });
  }

  async unlike(userId: string, mediaId: string) {
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.mediaLike.deleteMany({
        where: { userId, mediaId },
      });

      if (removed.count === 1) {
        await tx.exerciseMedia.update({
          where: { id: mediaId },
          data: { likes: { decrement: 1 } },
        });
        await tx.exerciseMedia.updateMany({
          where: { id: mediaId, likes: { lt: 0 } },
          data: { likes: 0 },
        });
      }
    });
  }

  async deleteMedia(mediaId: string, userId: string, userRole: Role) {
    const media = await this.prisma.exerciseMedia.findUnique({
      where: { id: mediaId },
    });
    if (!media) {
      throw new NotFoundException(`Media with ID ${mediaId} not found`);
    }

    if (media.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to delete this media',
      );
    }

    await this.storageService.deleteFileByUrl(media.url);

    return this.prisma.exerciseMedia.delete({
      where: { id: mediaId },
    });
  }

  async updateStatus(mediaId: string, isPaused: boolean) {
    const media = await this.prisma.exerciseMedia.findUnique({
      where: { id: mediaId },
    });
    if (!media) {
      throw new NotFoundException(`Media with ID ${mediaId} not found`);
    }

    return this.prisma.exerciseMedia.update({
      where: { id: mediaId },
      data: { isPaused },
    });
  }
}
