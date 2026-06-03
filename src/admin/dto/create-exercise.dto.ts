import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsUrl, IsIn, IsObject } from 'class-validator';

export class CreateExerciseDto {
  @ApiProperty({
    example: { en: 'Bench Press', es: 'Press de banca' },
    description: 'Nombres localizados del ejercicio',
  })
  @IsObject()
  name: Record<string, string>;

  @ApiPropertyOptional({
    example: {
      en: 'A classic chest push exercise.',
      es: 'Un ejercicio clásico de empuje para desarrollar el pecho.',
    },
    description: 'Descripciones localizadas del ejercicio',
  })
  @IsOptional()
  @IsObject()
  description?: Record<string, string>;

  @ApiPropertyOptional({
    example: {
      en: ['Lie flat on the bench', 'Press the weight up'],
      es: ['Acuéstate en el banco', 'Empuja el peso hacia arriba'],
    },
    description: 'Instrucciones/pasos localizados del ejercicio',
  })
  @IsOptional()
  @IsObject()
  instructions?: Record<string, string[]>;

  @ApiPropertyOptional({ example: 'intermediate' })
  @IsOptional()
  @IsString()
  @IsIn(['beginner', 'intermediate', 'expert'])
  difficulty?: string;

  @ApiPropertyOptional({ example: 'compound' })
  @IsOptional()
  @IsString()
  @IsIn(['compound', 'isolation'])
  mechanic?: string;

  @ApiPropertyOptional({ example: 'push' })
  @IsOptional()
  @IsString()
  @IsIn(['push', 'pull', 'static'])
  force?: string;

  @ApiPropertyOptional({ example: 'barbell' })
  @IsOptional()
  @IsString()
  equipment?: string;

  @ApiPropertyOptional({ example: 'Id de la categoría' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Arreglo de URLs de imágenes o videos',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}
