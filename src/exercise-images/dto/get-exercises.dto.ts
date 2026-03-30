import { IsOptional, IsString, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetExercisesDto {
    @ApiPropertyOptional({ description: 'Page number', default: '1' })
    @IsOptional()
    @IsNumberString()
    page?: string;

    @ApiPropertyOptional({ description: 'Items per page', default: '10' })
    @IsOptional()
    @IsNumberString()
    limit?: string;
}
