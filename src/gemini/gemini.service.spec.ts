import { Test, TestingModule } from '@nestjs/testing';
import { GeminiService } from './gemini.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('fake-api-key'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            aiResponseCache: { findUnique: jest.fn(), upsert: jest.fn() },
            user: { findUnique: jest.fn(), update: jest.fn() },
            exercise: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
