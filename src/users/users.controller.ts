import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  Query,
  Param,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiConsumes,
  ApiParam,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FindAllRoutinesDto } from '../routines/dto/find-all-routines.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req) {
    const user = await this.usersService.findOne({ id: req.user.id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password: _password, ...publicUser } = user;
    return publicUser;
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBody({ type: UpdateProfileDto })
  async updateProfile(@Request() req, @Body() updateData: UpdateProfileDto) {
    const user = await this.usersService.update(req.user.id, updateData);
    const { password: _password, ...publicUser } = user;
    return publicUser;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user training statistics' })
  async getStats(@Request() req) {
    return this.usersService.getStats(req.user.id);
  }

  @Get('me/favorites')
  @ApiOperation({ summary: 'Get current user favorite routines (paginated)' })
  @ApiOkResponse({ description: 'Paginated list of favorited routines' })
  async getFavorites(@Request() req, @Query() query: FindAllRoutinesDto) {
    return this.usersService.getFavorites(req.user.id, query);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or replace current user avatar' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(req.user.id, file);
  }

  @Get(':usernameOrId/followers')
  @ApiOperation({ summary: 'List followers of a user (paginated)' })
  @ApiParam({ name: 'usernameOrId', description: 'Username or user UUID' })
  async getFollowers(
    @Param('usernameOrId') usernameOrId: string,
    @Query() query: PaginationDto,
  ) {
    const profile = await this.usersService.getPublicProfile(usernameOrId);
    return this.usersService.getFollowers(profile.id, query);
  }

  @Get(':usernameOrId/following')
  @ApiOperation({ summary: 'List users followed by a user (paginated)' })
  @ApiParam({ name: 'usernameOrId', description: 'Username or user UUID' })
  async getFollowing(
    @Param('usernameOrId') usernameOrId: string,
    @Query() query: PaginationDto,
  ) {
    const profile = await this.usersService.getPublicProfile(usernameOrId);
    return this.usersService.getFollowing(profile.id, query);
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Follow a user (idempotent)' })
  @ApiParam({ name: 'id', description: 'User UUID to follow' })
  @ApiNoContentResponse()
  async follow(@Request() req, @Param('id') id: string) {
    return this.usersService.follow(req.user.id, id);
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfollow a user (idempotent)' })
  @ApiParam({ name: 'id', description: 'User UUID to unfollow' })
  @ApiNoContentResponse()
  async unfollow(@Request() req, @Param('id') id: string) {
    return this.usersService.unfollow(req.user.id, id);
  }

  @Get(':usernameOrId')
  @ApiOperation({ summary: 'Get public profile by username or user id' })
  @ApiParam({ name: 'usernameOrId', description: 'Username or user UUID' })
  async getPublicProfile(
    @Request() req,
    @Param('usernameOrId') usernameOrId: string,
  ) {
    return this.usersService.getPublicProfile(usernameOrId, req.user.id);
  }
}
