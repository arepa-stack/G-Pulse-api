import { Module } from '@nestjs/common';
import { ExerciseImagesController } from './exercise-images.controller';
import { ExerciseImagesService } from './exercise-images.service';

@Module({
    controllers: [ExerciseImagesController],
    providers: [ExerciseImagesService],
})
export class ExerciseImagesModule { }
