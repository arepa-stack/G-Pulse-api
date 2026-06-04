import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadExerciseMediaDto {
  @ApiProperty({ description: 'The ID of the exercise' })
  @IsString()
  exerciseId: string;

  @ApiPropertyOptional({
    description: 'Whether the uploaded media is visible to everyone',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublic?: boolean = false;
}
