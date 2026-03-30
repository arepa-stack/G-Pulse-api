import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProgressService } from './progress.service';
import { LogActivityDto } from './dto/log-activity.dto';

@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(AuthGuard('firebase-jwt'))
@Controller('progress')
export class ProgressController {
    constructor(private progressService: ProgressService) { }

    @Post('log')
    @ApiOperation({ summary: 'Log a completed workout activity' })
    async logActivity(@Request() req, @Body() logData: LogActivityDto) {
        return this.progressService.logActivity(req.user.uid, logData);
    }

    @Get('history')
    @ApiOperation({ summary: 'Get workout activity history' })
    async getHistory(@Request() req) {
        return this.progressService.getHistory(req.user.uid);
    }
}
