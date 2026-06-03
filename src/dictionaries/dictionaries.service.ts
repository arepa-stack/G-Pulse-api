import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DictionariesService {
  private cache: Record<string, Record<string, any>> | null = null;

  constructor(private prisma: PrismaService) {}

  async getDictionaries() {
    if (this.cache) {
      return this.cache;
    }

    const entries = await this.prisma.dictionary.findMany();
    const result: Record<string, Record<string, any>> = {};

    for (const entry of entries) {
      if (!result[entry.type]) {
        result[entry.type] = {};
      }
      result[entry.type][entry.key] = entry.translations;
    }

    this.cache = result;
    return result;
  }

  clearCache() {
    this.cache = null;
  }
}
