import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authUser = request.user;

    if (!authUser || !authUser.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Validate role from database
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.id },
      select: { role: true }
    });

    // We want to be able to accept Admin users even if the role is USER, admins can do anything
    // OR we strictly enforce the role. For standard RBAC, we check if the user's role is in the required array.
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
