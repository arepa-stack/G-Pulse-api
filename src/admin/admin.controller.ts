import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Role, SubscriptionPlan, Prisma } from '@prisma/client';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('users')
    @ApiOperation({ summary: 'Get all users with pagination and filters' })
    async getUsers(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('plan') plan?: SubscriptionPlan,
        @Query('role') role?: Role,
    ) {
        return this.adminService.findAllUsers(
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 10,
            search,
            plan,
            role
        );
    }

    @Get('users/:id')
    @ApiOperation({ summary: 'Get detailed information about a specific user' })
    async getUser(@Param('id') id: string) {
        return this.adminService.findUserById(id);
    }

    @Patch('users/:id')
    @ApiOperation({ summary: 'Update a user (e.g. change plan or role)' })
    async updateUser(
        @Param('id') id: string,
        @Body() updateData: Partial<Pick<Prisma.UserUpdateInput, 'name' | 'level' | 'plan' | 'role'>>,
    ) {
        return this.adminService.updateUser(id, updateData);
    }

    @Delete('users/:id')
    @ApiOperation({ summary: 'Delete a user permanently' })
    async deleteUser(@Param('id') id: string) {
        return this.adminService.deleteUser(id);
    }

    // ---- EXERCISES ----

    @Post('exercises')
    @ApiOperation({ summary: 'Create a new exercise in the catalog' })
    async createExercise(@Body() data: CreateExerciseDto) {
        return this.adminService.createExercise(data);
    }

    @Patch('exercises/:id')
    @ApiOperation({ summary: 'Update an existing exercise' })
    async updateExercise(
        @Param('id') id: string,
        @Body() data: UpdateExerciseDto,
    ) {
        return this.adminService.updateExercise(id, data);
    }

    @Delete('exercises/:id')
    @ApiOperation({ summary: 'Delete an exercise' })
    async deleteExercise(@Param('id') id: string) {
        return this.adminService.deleteExercise(id);
    }

    // ---- ROUTINES ----

    @Get('routines')
    @ApiOperation({ summary: 'Get all routines with pagination' })
    async getRoutines(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
    ) {
        return this.adminService.findAllRoutines(
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 10,
            search
        );
    }

    @Get('routines/:id')
    @ApiOperation({ summary: 'Get detailed information about a specific routine' })
    async getRoutine(@Param('id') id: string) {
        return this.adminService.findRoutineById(id);
    }

    // ---- STATS DASHBOARD ----

    @Get('stats')
    @ApiOperation({ summary: 'Get administrative dashboard statistics' })
    async getStats() {
        return this.adminService.getDashboardStats();
    }
}
