import {
  Controller,
  Post,
  Delete,
  Patch,
  Body,
  Param,
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
  @UseInterceptors(FileInterceptor('file'))
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
