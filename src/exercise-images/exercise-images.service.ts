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

    // 1. Verify exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: dto.exerciseId },
    });
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${dto.exerciseId} not found`);
    }

    // 2. Validate file type and map to MediaType enum
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

    // 3. Validate file size (10 MB maximum)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File size exceeds the 10MB limit.');
    }

    // 4. Clean up original filename to prevent storage path issues
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `exercise-images/${dto.exerciseId}/${Date.now()}_${sanitizedFilename}`;

    // 5. Upload to Supabase Storage
    const publicUrl = await this.storageService.uploadFile(file, path);

    // 6. Save reference in the database
    return this.prisma.exerciseMedia.create({
      data: {
        url: publicUrl,
        type: mediaType,
        exerciseId: dto.exerciseId,
        userId: userId,
        isPublic: dto.isPublic ?? false,
        isPaused: false,
      },
    });
  }

  async deleteMedia(mediaId: string, userId: string, userRole: Role) {
    // 1. Find media
    const media = await this.prisma.exerciseMedia.findUnique({
      where: { id: mediaId },
    });
    if (!media) {
      throw new NotFoundException(`Media with ID ${mediaId} not found`);
    }

    // 2. Authorization: Only the owner of the media or an ADMIN can delete it
    if (media.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to delete this media',
      );
    }

    // 3. Remove file from Supabase Storage
    await this.storageService.deleteFileByUrl(media.url);

    // 4. Remove database entry
    return this.prisma.exerciseMedia.delete({
      where: { id: mediaId },
    });
  }

  async updateStatus(mediaId: string, isPaused: boolean) {
    // 1. Find media
    const media = await this.prisma.exerciseMedia.findUnique({
      where: { id: mediaId },
    });
    if (!media) {
      throw new NotFoundException(`Media with ID ${mediaId} not found`);
    }

    // 2. Update status
    return this.prisma.exerciseMedia.update({
      where: { id: mediaId },
      data: { isPaused },
    });
  }
}
