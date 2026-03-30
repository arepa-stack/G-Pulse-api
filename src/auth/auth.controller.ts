import { Controller, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    async register(@Body() userData: RegisterDto) {
        return this.authService.register(userData.email, userData.password, userData.name);
    }

    @Post('login')
    @ApiOperation({ summary: 'Login with Firebase JWT' })
    @UseGuards(AuthGuard('firebase-jwt'))
    async login(@Request() req) {
        return this.authService.validateUser(req.user);
    }

    @Post('forgot-password')
    @ApiOperation({ summary: 'Send forgot password email' })
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.authService.forgotPassword(forgotPasswordDto.email);
    }
}
