import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionsService } from './subscriptions.service';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('subscriptions')
export class SubscriptionsController {
    constructor(private subscriptionsService: SubscriptionsService) { }

    @Post('upgrade')
    @ApiOperation({ summary: 'Upgrade user subscription plan' })
    async upgrade(@Request() req, @Body() upgradeData: UpgradeSubscriptionDto) {
        return this.subscriptionsService.createSubscription(req.user.id, upgradeData.plan);
    }
}
