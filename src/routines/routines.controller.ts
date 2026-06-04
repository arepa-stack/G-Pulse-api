import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { FindAllRoutinesDto } from './dto/find-all-routines.dto';
import { UpdateRoutineDto } from './dto/update-routine.dto';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('routines')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new routine' })
  @ApiBody({ type: CreateRoutineDto })
  @ApiCreatedResponse({ description: 'Routine created' })
  async createRoutine(
    @Request() req: AuthRequest,
    @Body() dto: CreateRoutineDto,
  ) {
    return this.routinesService.createRoutine({ ...dto, userId: req.user.id });
  }

  @Get()
  @ApiOperation({ summary: 'List all routines for the authenticated user' })
  async findAll(
    @Request() req: AuthRequest,
    @Query() query: FindAllRoutinesDto,
  ) {
    return this.routinesService.findAllForUser(req.user.id, query);
  }

  @Get('public')
  @ApiOperation({ summary: 'List all public routines' })
  async findPublic(@Query() query: FindAllRoutinesDto) {
    return this.routinesService.getPublicRoutines(query);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get the routine scheduled for today' })
  async getToday(@Request() req: AuthRequest) {
    return this.routinesService.getToday(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single routine by id' })
  @ApiParam({ name: 'id', description: 'Routine UUID' })
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.routinesService.findOneForUser(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a routine owned by the authenticated user' })
  @ApiParam({ name: 'id', description: 'Routine UUID' })
  @ApiBody({ type: UpdateRoutineDto })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateRoutineDto,
  ) {
    return this.routinesService.updateForUser(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a routine owned by the authenticated user' })
  @ApiParam({ name: 'id', description: 'Routine UUID' })
  @ApiNoContentResponse()
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.routinesService.removeForUser(req.user.id, id);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Like a public routine (idempotent)' })
  @ApiParam({ name: 'id', description: 'Routine UUID' })
  @ApiNoContentResponse()
  async like(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.routinesService.like(req.user.id, id);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a like from a routine (idempotent)' })
  @ApiParam({ name: 'id', description: 'Routine UUID' })
  @ApiNoContentResponse()
  async unlike(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.routinesService.unlike(req.user.id, id);
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Favorite a public routine (idempotent)' })
  @ApiParam({ name: 'id', description: 'Routine UUID' })
  @ApiNoContentResponse()
  async favorite(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.routinesService.favorite(req.user.id, id);
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a public routine from favorites (idempotent)' })
  @ApiParam({ name: 'id', description: 'Routine UUID' })
  @ApiNoContentResponse()
  async unfavorite(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.routinesService.unfavorite(req.user.id, id);
  }
}
