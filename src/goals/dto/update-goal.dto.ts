import { IsEnum, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GoalStatus } from '@prisma/client';

export class UpdateGoalDto {
  @ApiPropertyOptional({
    description: 'Target value for the goal (e.g. 75 kg, 4 workouts, 500 kcal)',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  targetValue?: number;

  @ApiPropertyOptional({
    description: 'Current progress value (especially for manual updates like WEIGHT)',
    example: 76.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentValue?: number;

  @ApiPropertyOptional({
    description: 'Target end date to achieve this goal',
    example: '2026-12-31T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Status of the goal',
    enum: GoalStatus,
    example: GoalStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
