import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() userData: RegisterDto) {
    return this.authService.register(
      userData.email,
      userData.password,
      userData.name,
    );
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('google')
  @ApiOperation({
    summary: 'Login with Google (Firebase ID token from client)',
  })
  async google(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body.idToken);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Send forgot password email' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }
}
