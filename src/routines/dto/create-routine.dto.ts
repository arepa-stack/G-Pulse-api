import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class RoutineExerciseDto {
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

    @ApiPropertyOptional({ description: 'Duration in seconds or description' })
    @IsOptional()
    @IsString()
    duration?: string;
}

export class CreateRoutineDto {
    @ApiProperty({ example: 'My Awesome Routine' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'uuid-of-user' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiPropertyOptional({ example: 'A brief description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;

    @ApiPropertyOptional({ description: 'Whether to use AI to generate exercises', default: false })
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
