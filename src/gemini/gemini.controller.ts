import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GeminiService } from './gemini.service';
import { GenerateTextDto } from './dto/generate-text.dto';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('gemini')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate text using Gemini AI' })
  async generateText(
    @Request() req: AuthRequest,
    @Body() body: GenerateTextDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.geminiService.generateText(
      body.prompt,
      false,
      req.user.id,
      body.forceUpdate,
      body.filters,
    );
  }
}
