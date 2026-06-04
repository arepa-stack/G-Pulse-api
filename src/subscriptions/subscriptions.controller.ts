import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionsService } from './subscriptions.service';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user subscription status' })
  @ApiOkResponse({
    description: 'plan, isActive, startDate, endDate, daysRemaining',
  })
  async getMine(@Request() req: AuthRequest) {
    return this.subscriptionsService.getStatus(req.user.id);
  }

  @Post('cancel')
  @ApiOperation({
    summary: 'Cancel active subscription (plan unchanged until endDate)',
  })
  @ApiOkResponse({ description: 'Cancellation message' })
  async cancel(@Request() req: AuthRequest) {
    return this.subscriptionsService.cancel(req.user.id);
  }

  @Post('upgrade')
  @ApiOperation({ summary: 'Upgrade user subscription plan' })
  @ApiBody({ type: UpgradeSubscriptionDto })
  async upgrade(@Request() req: AuthRequest, @Body() upgradeData: UpgradeSubscriptionDto) {
    return this.subscriptionsService.createSubscription(
      req.user.id,
      upgradeData.plan,
    );
  }
}
