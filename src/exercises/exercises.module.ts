import { Module } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { ExercisesController } from './exercises.controller';

@Module({
  providers: [ExercisesService],
  controllers: [ExercisesController],
  exports: [ExercisesService],
})
export class ExercisesModule {}
