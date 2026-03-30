import { Controller, Get, Patch, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard('firebase-jwt'))
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get('profile')
    @ApiOperation({ summary: 'Get current user profile' })
    async getProfile(@Request() req) {
        const user = await this.usersService.findOne({ googleId: req.user.uid });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    @Patch('profile')
    @ApiOperation({ summary: 'Update user profile' })
    async updateProfile(
        @Request() req,
        @Body() updateData: UpdateProfileDto,
    ) {
        return this.usersService.update(req.user.uid, updateData);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get user training statistics' })
    async getStats(@Request() req) {
        return this.usersService.getStats(req.user.uid);
    }
}
