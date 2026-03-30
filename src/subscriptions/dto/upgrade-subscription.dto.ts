import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';

export class UpgradeSubscriptionDto {
    @ApiProperty({ enum: SubscriptionPlan, description: 'The training plan to upgrade to' })
    @IsNotEmpty()
    @IsEnum(SubscriptionPlan)
    plan: SubscriptionPlan;
}
