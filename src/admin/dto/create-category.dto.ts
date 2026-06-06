import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Strength',
    description: 'Nombre único de la categoría',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
