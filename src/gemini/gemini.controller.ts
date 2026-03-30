import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GeminiService } from './gemini.service';
import { GenerateTextDto } from './dto/generate-text.dto';

@ApiTags('gemini')
@Controller('gemini')
export class GeminiController {
    constructor(private readonly geminiService: GeminiService) { }

    @Post('generate')
    @ApiOperation({ summary: 'Generate text using Gemini AI' })
    async generateText(@Body() body: GenerateTextDto) {
        return this.geminiService.generateText(body.prompt, false, body.userId, body.forceUpdate, body.filters);
    }
}
