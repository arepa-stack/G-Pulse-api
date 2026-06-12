import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { User, Prisma } from '@prisma/client';
import { FindAllRoutinesDto } from '../routines/dto/find-all-routines.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
  level: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async findOne(
    uniqueInput: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: uniqueInput,
    });
  }

  async update(id: string, data: UpdateProfileDto) {
    if (data.username) {
      const existing = await this.prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Username is already taken');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateByEmail(email: string, data: Partial<Prisma.UserUpdateInput>) {
    return this.prisma.user.update({
      where: { email },
      data,
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed for avatars');
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('Avatar file size exceeds the 5MB limit.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `avatars/${userId}/${Date.now()}_${sanitizedFilename}`;
    const publicUrl = await this.storageService.uploadFile(file, path);

    if (user.avatarUrl) {
      await this.storageService.deleteFileByUrl(user.avatarUrl);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
      select: PUBLIC_USER_SELECT,
    });
  }

  async getPublicProfile(usernameOrId: string, viewerId?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrId }, { id: usernameOrId }],
      },
      select: PUBLIC_USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [
      followersCount,
      followingCount,
      publicRoutinesCount,
      mediaLikesReceived,
      publicRoutines,
    ] = await this.prisma.$transaction([
      this.prisma.userFollow.count({ where: { followingId: user.id } }),
      this.prisma.userFollow.count({ where: { followerId: user.id } }),
      this.prisma.routine.count({
        where: { creatorId: user.id, isPublic: true },
      }),
      this.prisma.exerciseMedia.aggregate({
        where: { userId: user.id, isPublic: true, isPaused: false },
        _sum: { likes: true },
      }),
      this.prisma.routine.findMany({
        where: { creatorId: user.id, isPublic: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          description: true,
          likes: true,
          createdAt: true,
          _count: { select: { exercises: true } },
        },
      }),
    ]);

    let isFollowedByViewer = false;
    if (viewerId) {
      const follow = await this.prisma.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: user.id,
          },
        },
      });
      isFollowedByViewer = !!follow;
    }

    return {
      ...user,
      stats: {
        followersCount,
        followingCount,
        publicRoutinesCount,
        mediaLikesReceived: mediaLikesReceived._sum.likes ?? 0,
      },
      publicRoutines,
      isFollowedByViewer,
    };
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.userFollow.createMany({
      data: [{ followerId, followingId }],
      skipDuplicates: true,
    });
  }

  async unfollow(followerId: string, followingId: string) {
    await this.prisma.userFollow.deleteMany({
      where: { followerId, followingId },
    });
  }

  async getFollowers(userId: string, q: PaginationDto) {
    const take = q.limit ? parseInt(q.limit) : 20;
    const skip = q.page ? (parseInt(q.page) - 1) * take : 0;

    const where: Prisma.UserFollowWhereInput = { followingId: userId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.userFollow.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: { select: PUBLIC_USER_SELECT },
        },
      }),
      this.prisma.userFollow.count({ where }),
    ]);

    return {
      data: rows.map((row) => row.follower),
      meta: {
        total,
        page: q.page ? +q.page : 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getFollowing(userId: string, q: PaginationDto) {
    const take = q.limit ? parseInt(q.limit) : 20;
    const skip = q.page ? (parseInt(q.page) - 1) * take : 0;

    const where: Prisma.UserFollowWhereInput = { followerId: userId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.userFollow.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          following: { select: PUBLIC_USER_SELECT },
        },
      }),
      this.prisma.userFollow.count({ where }),
    ]);

    return {
      data: rows.map((row) => row.following),
      meta: {
        total,
        page: q.page ? +q.page : 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getStats(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            routines: true,
            activityLogs: true,
          },
        },
        activityLogs: {
          select: {
            calories: true,
            duration: true,
          },
        },
      },
    });

    if (!user) return null;

    const totalCalories = user.activityLogs.reduce(
      (sum, log) => sum + log.calories,
      0,
    );
    const totalDuration = user.activityLogs.reduce(
      (sum, log) => sum + log.duration,
      0,
    );

    return {
      trainingStreak: user.trainingStreak,
      routinesCount: user._count.routines,
      totalWorkouts: user._count.activityLogs,
      totalCalories,
      totalDurationMinutes: totalDuration,
      plan: user.plan,
      level: user.level,
    };
  }

  async getFavorites(userId: string, q: FindAllRoutinesDto) {
    const take = q.limit ? parseInt(q.limit) : 20;
    const skip = q.page ? (parseInt(q.page) - 1) * take : 0;

    const where: Prisma.UserFavoriteWhereInput = {
      userId,
      ...(q.search && {
        routine: {
          name: { contains: q.search, mode: 'insensitive' },
        },
      }),
    };

    const [favorites, total] = await this.prisma.$transaction([
      this.prisma.userFavorite.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          routine: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatarUrl: true,
                },
              },
              _count: { select: { exercises: true } },
              // First exercise (order 0) with its cover image, for the routine card thumbnail
              exercises: {
                orderBy: { order: 'asc' },
                take: 1,
                select: {
                  media: { select: { url: true } },
                  exercise: {
                    select: {
                      thumbnail: true,
                      media: {
                        where: { isPaused: false },
                        take: 1,
                        orderBy: { createdAt: 'asc' },
                        select: { url: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.userFavorite.count({ where }),
    ]);

    const data = favorites.map((fav) => fav.routine);

    return {
      data,
      meta: {
        total,
        page: q.page ? +q.page : 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }
}
