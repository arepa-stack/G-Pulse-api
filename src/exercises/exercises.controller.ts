import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';
import { FindAllExercisesDto } from './dto/find-all-exercises.dto';

@ApiTags('exercises')
@Controller('exercises')
export class ExercisesController {
    constructor(private readonly exercisesService: ExercisesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all exercises with filters and pagination' })
    async findAll(@Query() query: FindAllExercisesDto) {
        const { muscle, difficulty, limit, page, search } = query;
        const take = limit ? parseInt(limit) : 20;
        const skip = page ? (parseInt(page) - 1) * take : 0;

        const where: any = {};

        if (difficulty) {
            where.difficulty = difficulty.toLowerCase();
        }

        if (muscle) {
            // Check both primary and secondary muscles
            where.OR = [
                { primaryMuscles: { some: { name: muscle.toLowerCase() } } },
                { secondaryMuscles: { some: { name: muscle.toLowerCase() } } }
            ];
        }

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        return this.exercisesService.findAll({
            skip,
            take,
            where
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single exercise by ID' })
    async findOne(@Param('id') id: string) {
        return this.exercisesService.findOne(id);
    }
}
