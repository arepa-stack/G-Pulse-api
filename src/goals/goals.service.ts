import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { Goal, GoalType } from '@prisma/client';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateGoalDto) {
    const goal = await this.prisma.goal.create({
      data: {
        userId,
        type: dto.type,
        targetValue: dto.targetValue,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });

    return this.populateGoalProgress(goal);
  }

  async findAllForUser(userId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(goals.map((goal) => this.populateGoalProgress(goal)));
  }

  async findOneForUser(userId: string, id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.populateGoalProgress(goal);
  }

  async updateForUser(userId: string, id: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updatedGoal = await this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.targetValue !== undefined && { targetValue: dto.targetValue }),
        ...(dto.currentValue !== undefined && { currentValue: dto.currentValue }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    return this.populateGoalProgress(updatedGoal);
  }

  async removeForUser(userId: string, id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.goal.delete({
      where: { id },
    });
  }

  // Helper method to dynamically compute and attach progress values based on ActivityLog
  private async populateGoalProgress(goal: Goal): Promise<Goal> {
    if (goal.type === GoalType.WEIGHT) {
      // Weight remains manually tracked on the Goal object itself
      return goal;
    }

    // Define time window (current week: Monday to Sunday)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    if (goal.type === GoalType.WORKOUTS_PER_WEEK) {
      const count = await this.prisma.activityLog.count({
        where: {
          userId: goal.userId,
          date: {
            gte: startOfWeek,
            lte: endOfWeek,
          },
        },
      });
      goal.currentValue = count;
    } else if (goal.type === GoalType.CALORIES_BURN) {
      const aggregate = await this.prisma.activityLog.aggregate({
        where: {
          userId: goal.userId,
          date: {
            gte: startOfWeek,
            lte: endOfWeek,
          },
        },
        _sum: {
          calories: true,
        },
      });
      goal.currentValue = aggregate._sum.calories || 0;
    } else if (goal.type === GoalType.DURATION_MINUTES) {
      const aggregate = await this.prisma.activityLog.aggregate({
        where: {
          userId: goal.userId,
          date: {
            gte: startOfWeek,
            lte: endOfWeek,
          },
        },
        _sum: {
          duration: true,
        },
      });
      goal.currentValue = aggregate._sum.duration || 0;
    }

    return goal;
  }
}
