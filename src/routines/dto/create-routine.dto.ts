import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoutineExerciseDto } from './routine-exercise.dto';

export class CreateRoutineDto {
  @ApiProperty({ example: 'My Awesome Routine' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'A brief description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to use AI to generate exercises',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  fromAi?: boolean;

  @ApiPropertyOptional({ description: 'The prompt for AI generation' })
  @IsOptional()
  @IsString()
  aiPrompt?: string;

  @ApiPropertyOptional({ type: [RoutineExerciseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutineExerciseDto)
  exercises?: RoutineExerciseDto[];
}
