import { IsOptional, IsDateString, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindMeasurementsDto {
  @ApiPropertyOptional({
    description: 'Filter measurements from this date (inclusive)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter measurements until this date (inclusive)',
    example: '2026-06-01T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', example: '30' })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
