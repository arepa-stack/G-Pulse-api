import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RoutineExerciseDto {
  @ApiPropertyOptional({
    description: 'Exercise UUID (preferred for personalized routines)',
  })
  @IsOptional()
  @IsString()
  exerciseId?: string;

  @ApiPropertyOptional({
    description: 'The name of the exercise (fallback when exerciseId is omitted)',
  })
  @IsOptional()
  @IsString()
  exerciseName?: string;

  @ApiPropertyOptional({
    description: 'User-uploaded ExerciseMedia UUID linked to this routine slot',
  })
  @IsOptional()
  @IsString()
  mediaId?: string;

  @ApiPropertyOptional({ description: 'Number of sets', default: 3 })
  @IsOptional()
  sets?: number;

  @ApiPropertyOptional({ description: 'Number of reps', default: 10 })
  @IsOptional()
  reps?: number;

  @ApiPropertyOptional({ description: 'Duration in seconds' })
  @IsOptional()
  duration?: string;
}
