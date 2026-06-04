import { IsEnum, IsNumber, IsOptional, IsDateString, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalType } from '@prisma/client';

export class CreateGoalDto {
  @ApiProperty({
    description: 'Type of goal',
    enum: GoalType,
    example: GoalType.WORKOUTS_PER_WEEK,
  })
  @IsNotEmpty()
  @IsEnum(GoalType)
  type: GoalType;

  @ApiProperty({
    description: 'Target value for the goal (e.g. 75 kg, 4 workouts, 500 kcal)',
    example: 4,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.1)
  targetValue: number;

  @ApiPropertyOptional({
    description: 'Target end date to achieve this goal',
    example: '2026-12-31T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
