import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExerciseImagesService } from './exercise-images.service';
import { GetExercisesDto } from './dto/get-exercises.dto';

@ApiTags('exercise-images')
@Controller('exercise-images')
export class ExerciseImagesController {
    constructor(private readonly exerciseImagesService: ExerciseImagesService) { }

    @Get()
    @ApiOperation({ summary: 'Get paginated exercises with image URLs' })
    getExercises(@Query() query: GetExercisesDto) {
        const { page = '1', limit = '10' } = query;
        return this.exerciseImagesService.getPaginatedExercises(
            parseInt(page, 10),
            parseInt(limit, 10),
        );
    }
}
