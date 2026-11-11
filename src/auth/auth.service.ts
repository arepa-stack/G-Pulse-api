import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { OAuth2Client } from 'google-auth-library';
import { User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private readonly bcryptRounds = 10;
  private readonly googleClient = new OAuth2Client();

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

      const token = this.signAccessToken(user);
      return { token, user: this.toPublicUser(user) };
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

  // Acepta dos tipos de token: Firebase ID token (clientes con Firebase SDK) o Google ID token
  // directo (app Android vía Credential Manager, audience = GOOGLE_WEB_CLIENT_ID).
  private async verifyGoogleToken(
    idToken: string,
  ): Promise<{ uid: string; email?: string; name?: string }> {
    try {
      const d: DecodedIdToken = await this.firebaseAdmin
        .getAuth()
        .verifyIdToken(idToken, true);
      return { uid: d.uid, email: d.email, name: d.name as string | undefined };
    } catch {
      // no es token Firebase: probamos como Google ID token
    }

    const audience = process.env.GOOGLE_WEB_CLIENT_ID;
    if (!audience) throw new UnauthorizedException('Invalid or expired token');
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
      const p = ticket.getPayload();
      // Solo email verificado: findOrCreateUser enlaza cuentas existentes por email.
      if (!p?.sub || !p.email_verified) throw new Error('unverified');
      return { uid: p.sub, email: p.email, name: p.name };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async googleLogin(idToken: string) {
    const decoded = await this.verifyGoogleToken(idToken);

    const email = decoded.email;
    if (!email) {
      throw new UnauthorizedException('Token has no email claim');
    }

    const name = decoded.name || 'User';
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

  // Login valida contra el bcrypt local, así que el reset también: código de 6 dígitos por email.
  async forgotPassword(email: string) {
    const generic = { message: 'If the email exists, a reset code was sent.' };
    const user = await this.usersService.findOne({ email });
    // Cuentas solo-Google no tienen contraseña; respuesta genérica para no filtrar qué emails existen.
    if (!user?.password) return generic;

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.usersService.updateByEmail(email, {
      resetCodeHash: await bcrypt.hash(code, this.bcryptRounds),
      resetCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
      resetCodeAttempts: 0,
    });
    await this.mailService.sendPasswordReset(email, user.name ?? 'Usuario', code);
    return generic;
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const invalid = new BadRequestException('Invalid or expired code');
    const user = await this.usersService.findOne({ email });
    if (
      !user?.resetCodeHash ||
      !user.resetCodeExpires ||
      user.resetCodeExpires < new Date() ||
      user.resetCodeAttempts >= 5 // anti fuerza bruta: 5 intentos por código
    ) {
      throw invalid;
    }

    if (!(await bcrypt.compare(code, user.resetCodeHash))) {
      await this.usersService.updateByEmail(email, {
        resetCodeAttempts: { increment: 1 },
      });
      throw invalid;
    }

    await this.usersService.updateByEmail(email, {
      password: await bcrypt.hash(newPassword, this.bcryptRounds),
      resetCodeHash: null,
      resetCodeExpires: null,
      resetCodeAttempts: 0,
    });
    await this.mailService.sendPasswordChanged(email, user.name ?? 'Usuario');
    return { message: 'Password updated successfully' };
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
    await this.usersService.updateByEmail(user.email, { password: hashedNew });

    await this.mailService.sendPasswordChanged(
      user.email,
      user.name ?? 'Usuario',
    );

    return { message: 'Password updated successfully' };
  }
}
