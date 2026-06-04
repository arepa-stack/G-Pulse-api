import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBody,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new goal for the authenticated user' })
  @ApiBody({ type: CreateGoalDto })
  @ApiCreatedResponse({ description: 'Goal created with computed progress' })
  async create(@Request() req: AuthRequest, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all goals of the authenticated user' })
  @ApiOkResponse({ description: 'List of goals with progress' })
  async findAll(@Request() req: AuthRequest) {
    return this.goalsService.findAllForUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a single goal by ID' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiOkResponse({ description: 'Goal with progress' })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiForbiddenResponse({ description: 'Goal belongs to another user' })
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.goalsService.findOneForUser(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update goal details or progress' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiBody({ type: UpdateGoalDto })
  @ApiOkResponse({ description: 'Updated goal with progress' })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiForbiddenResponse({ description: 'Goal belongs to another user' })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.updateForUser(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a goal' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiForbiddenResponse({ description: 'Goal belongs to another user' })
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.goalsService.removeForUser(req.user.id, id);
  }
}
