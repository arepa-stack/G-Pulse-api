import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlan, UserLevel } from '@prisma/client';

export class UpdateProfileDto {
    @ApiPropertyOptional({ example: 'John Doe' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ enum: UserLevel })
    @IsOptional()
    @IsEnum(UserLevel)
    level?: UserLevel;

    @ApiPropertyOptional({ enum: SubscriptionPlan })
    @IsOptional()
    @IsEnum(SubscriptionPlan)
    plan?: SubscriptionPlan;
}
