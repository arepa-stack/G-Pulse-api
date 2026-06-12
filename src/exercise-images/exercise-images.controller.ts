import {
  Controller,
  Post,
  Delete,
  Patch,
  Get,
  Body,
  Param,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExerciseImagesService } from './exercise-images.service';
import { UploadExerciseMediaDto } from './dto/upload-exercise-media.dto';
import { UpdateMediaStatusDto } from './dto/update-media-status.dto';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Role } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

interface AuthRequest extends Request {
  user: { id: string; email: string; role: Role };
}

@ApiTags('exercise-images')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('exercise-images')
export class ExerciseImagesController {
  constructor(
    private readonly exerciseImagesService: ExerciseImagesService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload custom exercise media (image, gif, video)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The media file to upload (image, gif, or video)',
        },
        exerciseId: {
          type: 'string',
          description: 'ID of the exercise this media belongs to',
        },
        isPublic: {
          type: 'boolean',
          description: 'Whether the uploaded media is visible to everyone',
          default: false,
        },
        caption: {
          type: 'string',
          description: 'Optional caption for the media',
        },
      },
      required: ['file', 'exerciseId'],
    },
  })
  async uploadMedia(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadExerciseMediaDto,
  ) {
    return this.exerciseImagesService.uploadMedia(req.user.id, file, dto);
  }

  @Get('my/:exerciseId')
  @ApiOperation({ summary: 'List current user media for a specific exercise' })
  @ApiParam({ name: 'exerciseId', description: 'Exercise UUID' })
  async getMyMediaByExercise(
    @Req() req: AuthRequest,
    @Param('exerciseId') exerciseId: string,
    @Query() query: PaginationDto,
  ) {
    return this.exerciseImagesService.getMyMediaByExercise(
      req.user.id,
      exerciseId,
      query,
    );
  }

  @Get('by-user/:userId')
  @ApiOperation({ summary: 'List public exercise media uploaded by a user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  async getPublicMediaByUser(
    @Param('userId') userId: string,
    @Query() query: PaginationDto,
  ) {
    return this.exerciseImagesService.getPublicMediaByUser(userId, query);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Like public exercise media (idempotent)' })
  @ApiParam({ name: 'id', description: 'Exercise media UUID' })
  @ApiNoContentResponse()
  async like(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.exerciseImagesService.like(req.user.id, id);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a like from exercise media (idempotent)' })
  @ApiParam({ name: 'id', description: 'Exercise media UUID' })
  @ApiNoContentResponse()
  async unlike(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.exerciseImagesService.unlike(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user-uploaded or admin media' })
  @ApiParam({ name: 'id', description: 'Exercise media UUID' })
  @ApiNoContentResponse()
  async deleteMedia(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.exerciseImagesService.deleteMedia(id, req.user.id, req.user.role);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Pause or resume exercise media (Admin only)' })
  @ApiParam({ name: 'id', description: 'Exercise media UUID' })
  @ApiBody({ type: UpdateMediaStatusDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMediaStatusDto,
  ) {
    return this.exerciseImagesService.updateStatus(id, dto.isPaused);
  }
}
