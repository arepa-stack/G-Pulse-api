import {
  Controller,
  Post,
  Delete,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UnregisterTokenDto } from './dto/unregister-token.dto';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  @ApiOperation({
    summary: 'Register FCM device token (call after login from mobile app)',
  })
  @ApiBody({ type: RegisterTokenDto })
  @ApiOkResponse({ description: 'Token registered or updated' })
  async register(@Request() req: AuthRequest, @Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerToken(req.user.id, dto);
  }

  @Delete('register-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister FCM device token (call on logout)' })
  @ApiBody({ type: UnregisterTokenDto })
  @ApiNoContentResponse()
  async unregister(
    @Request() req: AuthRequest,
    @Body() body: UnregisterTokenDto,
  ) {
    return this.notificationsService.unregisterToken(req.user.id, body.token);
  }
}
