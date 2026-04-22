import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DecodedIdToken } from 'firebase-admin/auth';
import { User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private readonly bcryptRounds = 10;

  constructor(
    private usersService: UsersService,
    private firebaseAdmin: FirebaseAdminService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  private toPublicUser(user: User): Omit<User, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest;
  }

  private signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  async register(email: string, password: string, name: string) {
    try {
      const firebaseUser = await this.firebaseAdmin.getAuth().createUser({
        email,
        password,
        displayName: name,
      });

      const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);

      const user = await this.usersService.create({
        email: firebaseUser.email || email,
        googleId: firebaseUser.uid,
        name: name,
        password: hashedPassword,
      });

      await this.mailService.sendWelcome(user.email, user.name ?? name);

      return this.toPublicUser(user);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Registration failed';
      throw new BadRequestException(msg);
    }
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findOne({ email });

    if (!user?.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.signAccessToken(user);
    return { token, user: this.toPublicUser(user) };
  }

  async googleLogin(idToken: string) {
    let decoded: DecodedIdToken;
    try {
      decoded = await this.firebaseAdmin.getAuth().verifyIdToken(idToken, true);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const email = decoded.email;
    if (!email) {
      throw new UnauthorizedException('Token has no email claim');
    }

    const name = (decoded.name as string | undefined) || 'User';
    const user = await this.findOrCreateUser(email, decoded.uid, name);
    const token = this.signAccessToken(user);

    return { token, user: this.toPublicUser(user) };
  }

  private async findOrCreateUser(
    email: string,
    uid: string,
    name: string,
  ): Promise<User> {
    let user = await this.usersService.findOne({ googleId: uid });

    if (!user && email) {
      user = await this.usersService.findOne({ email });
      if (user && !user.googleId) {
        user = await this.usersService.updateByEmail(email, { googleId: uid });
      }
    }

    if (!user) {
      user = await this.usersService.create({
        email: email || `${uid}@placeholder.com`,
        googleId: uid,
        name: name || 'User',
      });
    }
    return user;
  }

  async getSession(userId: string) {
    const user = await this.usersService.findOne({ id: userId });
    if (!user) {
      throw new UnauthorizedException('Session no longer valid');
    }
    return { authenticated: true, user: this.toPublicUser(user) };
  }

  async forgotPassword(email: string) {
    try {
      const link = await this.firebaseAdmin
        .getAuth()
        .generatePasswordResetLink(email);

      const user = await this.usersService.findOne({ email });
      await this.mailService.sendPasswordReset(
        email,
        user?.name ?? 'Usuario',
        link,
      );

      return {
        message: 'If the email exists, a reset link has been generated.',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Request failed';
      throw new BadRequestException(msg);
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findOne({ id: userId });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'This account uses social login and does not have a password',
      );
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNew = await bcrypt.hash(newPassword, this.bcryptRounds);
    await this.usersService.update(userId, { password: hashedNew });

    await this.mailService.sendPasswordChanged(
      user.email,
      user.name ?? 'Usuario',
    );

    return { message: 'Password updated successfully' };
  }
}
