import { IsInt, Min, Max, IsUUID, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertScheduleDto {
  @ApiProperty({
    description: 'Day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'UUID of the routine to schedule',
    example: 'd3b07384-d113-4956-a5cc-98715b5664ad',
  })
  @IsUUID()
  routineId: string;

  @ApiPropertyOptional({
    description: 'Whether the schedule is enabled',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
