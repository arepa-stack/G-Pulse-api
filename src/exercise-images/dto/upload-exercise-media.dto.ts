import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
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

  @ApiPropertyOptional({
    description: 'Optional caption describing how the user performs the exercise',
    example: 'Asi hago yo el press de banca con agarre medio',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}
