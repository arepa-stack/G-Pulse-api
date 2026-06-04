import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
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
  ApiBadRequestResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MeasurementsService } from './measurements.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { FindMeasurementsDto } from './dto/find-measurements.dto';

interface AuthRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('measurements')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a body measurement entry' })
  @ApiCreatedResponse({ description: 'Measurement created' })
  @ApiBadRequestResponse({ description: 'No metric fields provided' })
  async create(@Request() req: AuthRequest, @Body() dto: CreateMeasurementDto) {
    return this.measurementsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List body measurements (paginated, optional date range)' })
  @ApiOkResponse({ description: 'Paginated measurement history' })
  async findAll(
    @Request() req: AuthRequest,
    @Query() query: FindMeasurementsDto,
  ) {
    return this.measurementsService.findAll(req.user.id, query);
  }

  @Get('latest')
  @ApiOperation({
    summary: 'Get the most recent value for each metric type',
  })
  @ApiOkResponse({ description: 'Latest non-null value per metric' })
  async latest(@Request() req: AuthRequest) {
    return this.measurementsService.latest(req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a body measurement owned by the user' })
  @ApiParam({ name: 'id', description: 'Measurement UUID' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Not found or not owned by user' })
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.measurementsService.remove(req.user.id, id);
  }
}
