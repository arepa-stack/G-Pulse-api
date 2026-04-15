import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-me-in-production'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, FirebaseAdminService],
  controllers: [AuthController],
})
export class AuthModule {}
