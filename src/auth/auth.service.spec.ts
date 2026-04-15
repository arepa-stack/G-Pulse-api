import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { FirebaseAdminService } from './firebase-admin.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateByEmail: jest.fn(),
          },
        },
        {
          provide: FirebaseAdminService,
          useValue: {
            getAuth: jest.fn().mockReturnValue({
              createUser: jest.fn(),
              generatePasswordResetLink: jest.fn(),
              verifyIdToken: jest.fn(),
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('test-jwt'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
