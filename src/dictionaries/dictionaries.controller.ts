import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DictionariesService } from './dictionaries.service';

@ApiTags('dictionaries')
@Controller('dictionaries')
export class DictionariesController {
  constructor(private readonly dictionariesService: DictionariesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all dictionaries/translations grouped by type and key' })
  async getDictionaries() {
    return this.dictionariesService.getDictionaries();
  }

  @Post('clear-cache')
  @ApiOperation({ summary: 'Clear the dictionaries cache' })
  clearCache() {
    this.dictionariesService.clearCache();
    return { success: true, message: 'Cache cleared' };
  }
}
