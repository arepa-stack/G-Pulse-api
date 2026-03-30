import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsUrl, IsIn } from 'class-validator';

export class CreateExerciseDto {
    @ApiProperty({ example: 'Bench Press' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Un ejercicio clásico de empuje para desarrollar el pecho.' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: ['Acuéstate', 'Empuja la barra', 'Baja controlado'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    instructions?: string[];

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

    @ApiPropertyOptional({ description: 'Arreglo de URLs de imágenes o videos', type: [String] })
    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    imageUrls?: string[];
}
