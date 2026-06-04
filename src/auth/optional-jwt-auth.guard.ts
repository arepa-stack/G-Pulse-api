import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest to not throw an error if user is not authenticated
  handleRequest(err, user, info, context) {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
