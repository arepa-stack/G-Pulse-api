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

  @Get(':id')
  @ApiOperation({ summary: 'Get a single routine by id' })
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.routinesService.findOneForUser(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a routine owned by the authenticated user' })
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
  @ApiNoContentResponse()
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.routinesService.removeForUser(req.user.id, id);
  }
}
