import { IsString, IsNotEmpty, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class GeminiFiltersDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    muscle?: string;
}

export class GenerateTextDto {
    @ApiProperty({ example: 'Suggest a full body workout' })
    @IsString()
    @IsNotEmpty()
    prompt: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    userId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    forceUpdate?: boolean;

    @ApiPropertyOptional({ type: GeminiFiltersDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => GeminiFiltersDto)
    filters?: GeminiFiltersDto;
}
