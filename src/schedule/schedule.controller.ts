import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ScheduleService } from './schedule.service';
import { UpsertScheduleDto } from './dto/upsert-schedule.dto';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('schedule')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @ApiOperation({
    summary: 'Schedule or replace a routine for a day of the week',
  })
  async upsert(@Request() req: AuthRequest, @Body() dto: UpsertScheduleDto) {
    return this.scheduleService.upsert(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get the weekly routine schedule' })
  async list(@Request() req: AuthRequest) {
    return this.scheduleService.list(req.user.id);
  }

  @Delete(':dayOfWeek')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove routine assignment for a day of the week' })
  @ApiNoContentResponse()
  async remove(
    @Request() req: AuthRequest,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
  ) {
    return this.scheduleService.remove(req.user.id, dayOfWeek);
  }
}
