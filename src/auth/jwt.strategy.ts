import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';

export type JwtValidatedUser = {
  id: string;
  email: string;
  role: Role;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'change-me-in-production',
      ),
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: Role;
  }): Promise<JwtValidatedUser> {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
