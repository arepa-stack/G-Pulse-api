import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FeedService } from './feed.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('feed')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @ApiOperation({
    summary:
      'Discovery feed mixing public routines and exercise media, prioritizing followed users',
  })
  async getFeed(@Request() req, @Query() query: PaginationDto) {
    return this.feedService.getFeed(req.user.id, query);
  }
}
