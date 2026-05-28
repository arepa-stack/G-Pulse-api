import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoutineExerciseDto {
  @ApiProperty({ description: 'The name of the exercise' })
  @IsString()
  @IsNotEmpty()
  exerciseName: string;

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
