import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProgressService } from './progress.service';
import { LogActivityDto } from './dto/log-activity.dto';

@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('progress')
export class ProgressController {
  constructor(private progressService: ProgressService) {}

  @Post('log')
  @ApiOperation({ summary: 'Log a completed workout activity' })
  async logActivity(@Request() req, @Body() logData: LogActivityDto) {
    return this.progressService.logActivity(req.user.id, logData);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get workout activity history' })
  async getHistory(@Request() req) {
    return this.progressService.getHistory(req.user.id);
  }

  @Get('prs')
  @ApiOperation({ summary: 'Get personal records (PRs) per exercise' })
  async getPersonalRecords(@Request() req) {
    return this.progressService.getPersonalRecords(req.user.id);
  }

  @Get('exercise/:id')
  @ApiOperation({ summary: 'Get history of a specific exercise' })
  async getExerciseHistory(@Request() req, @Param('id') id: string) {
    return this.progressService.getExerciseHistory(req.user.id, id);
  }
}

