import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogActivityDto {
    @ApiProperty({ description: 'ID of the routine performed', required: false })
    @IsOptional()
    @IsString()
    routineId?: string;

    @ApiProperty({ description: 'Duration of the workout in minutes' })
    @IsNotEmpty()
    @IsNumber()
    duration: number;

    @ApiProperty({ description: 'Estimated calories burned' })
    @IsNotEmpty()
    @IsNumber()
    calories: number;
}
