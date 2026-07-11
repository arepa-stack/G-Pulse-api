import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMuscleDto {
  @ApiProperty({ example: 'Biceps', description: 'Nombre único del músculo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'arms',
    description: 'Agrupación opcional del músculo (arms, legs, back, ...)',
  })
  @IsOptional()
  @IsString()
  target?: string;
}
