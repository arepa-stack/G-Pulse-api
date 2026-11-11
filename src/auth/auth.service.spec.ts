import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { MailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: { findOne: jest.Mock; updateByEmail: jest.Mock };
  let mail: { sendPasswordReset: jest.Mock; sendPasswordChanged: jest.Mock };

  beforeEach(async () => {
    users = { findOne: jest.fn(), updateByEmail: jest.fn() };
    mail = { sendPasswordReset: jest.fn(), sendPasswordChanged: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: FirebaseAdminService, useValue: { getAuth: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('test-jwt') } },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('forgot -> reset with emailed code updates password; wrong code counts an attempt', async () => {
    users.findOne.mockResolvedValue({ email: 'a@b.c', name: 'A', password: 'old' });
    await service.forgotPassword('a@b.c');
    const code: string = mail.sendPasswordReset.mock.calls[0][2];
    const saved = users.updateByEmail.mock.calls[0][1];
    expect(code).toMatch(/^\d{6}$/);

    users.findOne.mockResolvedValue({ email: 'a@b.c', name: 'A', ...saved });
    await expect(service.resetPassword('a@b.c', code === '000000' ? '111111' : '000000', 'newpass'))
      .rejects.toThrow('Invalid or expired code');
    expect(users.updateByEmail).toHaveBeenLastCalledWith('a@b.c', { resetCodeAttempts: { increment: 1 } });

    await service.resetPassword('a@b.c', code, 'newpass');
    const final = users.updateByEmail.mock.calls.at(-1)[1];
    expect(await bcrypt.compare('newpass', final.password)).toBe(true);
    expect(final.resetCodeHash).toBeNull();
  });

  it('rejects after 5 attempts and for google-only accounts sends nothing', async () => {
    users.findOne.mockResolvedValue({ email: 'a@b.c', resetCodeHash: 'x', resetCodeExpires: new Date(Date.now() + 60000), resetCodeAttempts: 5 });
    await expect(service.resetPassword('a@b.c', '123456', 'newpass')).rejects.toThrow();

    users.findOne.mockResolvedValue({ email: 'g@b.c', password: null });
    await service.forgotPassword('g@b.c');
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });
});
