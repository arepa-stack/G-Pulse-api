import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

type FeedItem =
  | {
      type: 'routine';
      data: Awaited<ReturnType<FeedService['fetchRoutineItems']>>[number];
      sortDate: Date;
      likes: number;
      priority: number;
    }
  | {
      type: 'media';
      data: Awaited<ReturnType<FeedService['fetchMediaItems']>>[number];
      sortDate: Date;
      likes: number;
      priority: number;
    };

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly routineInclude = {
    creator: {
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
      },
    },
    _count: { select: { exercises: true } },
  } as const;

  private readonly mediaInclude = {
    user: {
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
      },
    },
    exercise: {
      select: {
        id: true,
        name: true,
        thumbnail: true,
      },
    },
  } as const;

  private async fetchRoutineItems(where: object, take: number) {
    return this.prisma.routine.findMany({
      where,
      take,
      orderBy: [{ updatedAt: 'desc' }],
      include: this.routineInclude,
    });
  }

  private async fetchMediaItems(where: object, take: number) {
    return this.prisma.exerciseMedia.findMany({
      where,
      take,
      orderBy: [{ createdAt: 'desc' }],
      include: this.mediaInclude,
    });
  }

  async getFeed(userId: string, q: PaginationDto) {
    const take = q.limit ? parseInt(q.limit) : 20;
    const skip = q.page ? (parseInt(q.page) - 1) * take : 0;
    const fetchLimit = skip + take;

    const followingRows = await this.prisma.userFollow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = followingRows.map((row) => row.followingId);

    const [followedRoutines, followedMedia, popularRoutines, popularMedia] =
      await Promise.all([
        followingIds.length > 0
          ? this.fetchRoutineItems(
              { isPublic: true, creatorId: { in: followingIds } },
              fetchLimit,
            )
          : Promise.resolve([]),
        followingIds.length > 0
          ? this.fetchMediaItems(
              {
                isPublic: true,
                isPaused: false,
                userId: { in: followingIds },
              },
              fetchLimit,
            )
          : Promise.resolve([]),
        this.fetchRoutineItems({ isPublic: true }, fetchLimit),
        this.fetchMediaItems({ isPublic: true, isPaused: false }, fetchLimit),
      ]);

    const followedItems: FeedItem[] = [
      ...followedRoutines.map((routine) => ({
        type: 'routine' as const,
        data: routine,
        sortDate: routine.updatedAt,
        likes: routine.likes,
        priority: 1,
      })),
      ...followedMedia.map((media) => ({
        type: 'media' as const,
        data: media,
        sortDate: media.createdAt,
        likes: media.likes,
        priority: 1,
      })),
    ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

    const followedKeys = new Set(
      followedItems.map((item) => `${item.type}:${item.data.id}`),
    );

    const popularItems: FeedItem[] = [
      ...popularRoutines.map((routine) => ({
        type: 'routine' as const,
        data: routine,
        sortDate: routine.updatedAt,
        likes: routine.likes,
        priority: 0,
      })),
      ...popularMedia.map((media) => ({
        type: 'media' as const,
        data: media,
        sortDate: media.createdAt,
        likes: media.likes,
        priority: 0,
      })),
    ]
      .filter((item) => !followedKeys.has(`${item.type}:${item.data.id}`))
      .sort((a, b) => {
        if (b.likes !== a.likes) return b.likes - a.likes;
        return b.sortDate.getTime() - a.sortDate.getTime();
      });

    const merged = [...followedItems, ...popularItems];
    const pageItems = merged.slice(skip, skip + take);

    const [routineCount, mediaCount] = await this.prisma.$transaction([
      this.prisma.routine.count({ where: { isPublic: true } }),
      this.prisma.exerciseMedia.count({
        where: { isPublic: true, isPaused: false },
      }),
    ]);

    const total = routineCount + mediaCount;

    return {
      data: pageItems.map(({ type, data }) => ({ type, data })),
      meta: {
        total,
        page: q.page ? +q.page : 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }
}
