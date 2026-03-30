import { IsOptional, IsString, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindAllExercisesDto {
    @ApiPropertyOptional({ description: 'Muscle focused' })
    @IsOptional()
    @IsString()
    muscle?: string;

    @ApiPropertyOptional({ description: 'Exercise difficulty' })
    @IsOptional()
    @IsString()
    difficulty?: string;

    @ApiPropertyOptional({ description: 'Items per page', default: '20' })
    @IsOptional()
    @IsNumberString()
    limit?: string;

    @ApiPropertyOptional({ description: 'Page number', default: '1' })
    @IsOptional()
    @IsNumberString()
    page?: string;

    @ApiPropertyOptional({ description: 'Search term for exercise name' })
    @IsOptional()
    @IsString()
    search?: string;
}
