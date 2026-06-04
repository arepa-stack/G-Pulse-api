import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { Reflector } from '@nestjs/core';

describe('AdminController', () => {
  let controller: AdminController;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {
            findAllUsers: jest.fn(),
            findUserById: jest.fn(),
            updateUser: jest.fn(),
            deleteUser: jest.fn(),
            createExercise: jest.fn(),
            updateExercise: jest.fn(),
            deleteExercise: jest.fn(),
            findAllRoutines: jest.fn(),
            findRoutineById: jest.fn(),
            getDashboardStats: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
          },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updateUser', () => {
    it('should call adminService.updateUser with id and dto', async () => {
      const service = module.get(AdminService);
      const dto = { plan: 'PRO' as const };
      const expected = { id: 'u1', plan: 'PRO' };
      (service.updateUser as jest.Mock).mockResolvedValue(expected);

      const result = await controller.updateUser('u1', dto as any);

      expect(service.updateUser).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(expected);
    });
  });
});
