import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, MaxLength, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class WorkoutSetDto {
  @ApiProperty({ description: 'ID of the exercise performed' })
  @IsNotEmpty()
  @IsString()
  exerciseId: string;

  @ApiProperty({ description: 'Set number' })
  @IsNotEmpty()
  @IsNumber()
  setNumber: number;

  @ApiProperty({ description: 'Number of repetitions' })
  @IsNotEmpty()
  @IsNumber()
  reps: number;

  @ApiProperty({ description: 'Weight lifted in kg (optional)', required: false })
  @IsOptional()
  @IsNumber()
  weight?: number;
}

export class LogActivityDto {
  @ApiProperty({ description: 'ID of the routine performed', required: false })
  @IsOptional()
  @IsString()
  routineId?: string;

  @ApiProperty({ description: 'Duration of the workout in minutes' })
  @IsNotEmpty()
  @IsNumber()
  duration: number;

  @ApiProperty({ description: 'Estimated calories burned' })
  @IsNotEmpty()
  @IsNumber()
  calories: number;

  @ApiProperty({ description: 'Optional note about the session', required: false, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ description: 'Workout sets performed', type: [WorkoutSetDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetDto)
  sets?: WorkoutSetDto[];
}

