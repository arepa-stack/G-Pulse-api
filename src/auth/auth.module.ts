import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { FirebaseStrategy } from './firebase.strategy';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [UsersModule, PassportModule],
  providers: [AuthService, FirebaseStrategy, FirebaseAdminService],
  controllers: [AuthController],
})
export class AuthModule { }
