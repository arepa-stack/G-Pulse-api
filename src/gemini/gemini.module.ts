import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { GeminiController } from './gemini.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GeminiController],
  providers: [GeminiService],
  exports: [GeminiService]
})
export class GeminiModule { }
