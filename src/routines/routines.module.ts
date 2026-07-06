import { Module } from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { RoutinesController } from './routines.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiModule } from '../gemini/gemini.module';
import { ExercisesModule } from '../exercises/exercises.module';

@Module({
  imports: [PrismaModule, GeminiModule, ExercisesModule],
  providers: [RoutinesService],
  controllers: [RoutinesController],
  exports: [RoutinesService],
})
export class RoutinesModule {}
