import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto } from './dto/create-routine.dto';

@ApiTags('routines')
@Controller('routines')
export class RoutinesController {
    constructor(private readonly routinesService: RoutinesService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new routine' })
    async createRoutine(@Body() createRoutineDto: CreateRoutineDto) {
        return this.routinesService.createRoutine(createRoutineDto);
    }
}
