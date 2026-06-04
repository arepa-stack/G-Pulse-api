import { Module } from '@nestjs/common';
import { ExerciseImagesController } from './exercise-images.controller';
import { ExerciseImagesService } from './exercise-images.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ExerciseImagesController],
  providers: [ExerciseImagesService],
  exports: [ExerciseImagesService],
})
export class ExerciseImagesModule {}
