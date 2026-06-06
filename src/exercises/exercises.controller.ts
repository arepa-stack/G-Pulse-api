import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';
import { FindAllExercisesDto } from './dto/find-all-exercises.dto';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@ApiTags('exercises')
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all exercises with filters and pagination' })
  async findAll(@Request() req: any, @Query() query: FindAllExercisesDto = {}) {
    const { muscle, category, difficulty, limit, page, search } = query;
    const take = limit ? parseInt(limit) : 20;
    const skip = page ? (parseInt(page) - 1) * take : 0;

    const where: any = {};

    if (difficulty) {
      where.difficulty = difficulty.toLowerCase();
    }

    if (category) {
      where.categoryId = category;
    }

    if (muscle) {
      // Handle comma-separated list of muscles
      const muscleList = muscle.split(',').map((m) => m.trim().toLowerCase());
      where.OR = [
        { primaryMuscles: { some: { name: { in: muscleList } } } },
        { secondaryMuscles: { some: { name: { in: muscleList } } } },
      ];
    }

    return this.exercisesService.findAll({
      skip,
      take,
      where,
      search,
      user: req?.user,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single exercise by ID' })
  @ApiParam({ name: 'id', description: 'Exercise UUID' })
  @ApiOkResponse({ description: 'Exercise details' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.exercisesService.findOne(id, req.user);
  }
}
