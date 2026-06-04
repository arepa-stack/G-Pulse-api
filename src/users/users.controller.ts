import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FindAllRoutinesDto } from '../routines/dto/find-all-routines.dto';

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
    return this.usersService.update(req.user.id, updateData);
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
}
