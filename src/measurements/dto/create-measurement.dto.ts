import {
  IsOptional,
  IsDateString,
  IsNumber,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMeasurementDto {
  @ApiPropertyOptional({
    description: 'Measurement date (ISO 8601). Defaults to now.',
    example: '2026-06-04T08:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Body weight in kg', example: 82.3, minimum: 20, maximum: 300 })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(300)
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Body fat percentage', example: 18.5, minimum: 3, maximum: 60 })
  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(60)
  bodyFatPct?: number;

  @ApiPropertyOptional({ description: 'Waist circumference in cm', example: 85, minimum: 30, maximum: 200 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(200)
  waistCm?: number;

  @ApiPropertyOptional({ description: 'Chest circumference in cm', example: 100, minimum: 50, maximum: 200 })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(200)
  chestCm?: number;

  @ApiPropertyOptional({ description: 'Arm circumference in cm', example: 35, minimum: 15, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(100)
  armCm?: number;

  @ApiPropertyOptional({ description: 'Leg circumference in cm', example: 55, minimum: 30, maximum: 120 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(120)
  legCm?: number;

  @ApiPropertyOptional({ description: 'Hip circumference in cm', example: 95, minimum: 50, maximum: 200 })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(200)
  hipCm?: number;

  @ApiPropertyOptional({ description: 'Optional notes', example: 'Morning weigh-in' })
  @IsOptional()
  @IsString()
  notes?: string;
}
