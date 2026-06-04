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
            findAllMuscles: jest.fn(),
            createMuscle: jest.fn(),
            updateMuscle: jest.fn(),
            deleteMuscle: jest.fn(),
            findAllCategories: jest.fn(),
            createCategory: jest.fn(),
            updateCategory: jest.fn(),
            deleteCategory: jest.fn(),
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

      const result = await controller.updateUser('u1', dto);

      expect(service.updateUser).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(expected);
    });
  });

  // ---- MUSCLES (F-14 / Fibery #69) ----

  describe('muscles', () => {
    it('getMuscles delegates to adminService.findAllMuscles', async () => {
      const service = module.get(AdminService);
      const expected = [{ id: 'm1', name: 'Biceps' }];
      (service.findAllMuscles as jest.Mock).mockResolvedValue(expected);

      const result = await controller.getMuscles();

      expect(service.findAllMuscles).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });

    it('createMuscle delegates to adminService.createMuscle with the dto', async () => {
      const service = module.get(AdminService);
      const dto = { name: 'Forearms' };
      const expected = { id: 'm9', ...dto };
      (service.createMuscle as jest.Mock).mockResolvedValue(expected);

      const result = await controller.createMuscle(dto);

      expect(service.createMuscle).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });

    it('updateMuscle delegates to adminService.updateMuscle with id and dto', async () => {
      const service = module.get(AdminService);
      const dto = { name: 'Bíceps' };
      await controller.updateMuscle('m1', dto);

      expect(service.updateMuscle).toHaveBeenCalledWith('m1', dto);
    });

    it('deleteMuscle passes force=true when the query param is "true"', async () => {
      const service = module.get(AdminService);
      await controller.deleteMuscle('m1', 'true');

      expect(service.deleteMuscle).toHaveBeenCalledWith('m1', true);
    });

    it('deleteMuscle passes force=false when the query param is absent', async () => {
      const service = module.get(AdminService);
      await controller.deleteMuscle('m1', undefined);

      expect(service.deleteMuscle).toHaveBeenCalledWith('m1', false);
    });
  });

  // ---- CATEGORIES (F-14 / Fibery #70) ----

  describe('categories', () => {
    it('getCategories delegates to adminService.findAllCategories', async () => {
      const service = module.get(AdminService);
      const expected = [{ id: 'c1', name: 'Strength' }];
      (service.findAllCategories as jest.Mock).mockResolvedValue(expected);

      const result = await controller.getCategories();

      expect(service.findAllCategories).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });

    it('createCategory delegates to adminService.createCategory with the dto', async () => {
      const service = module.get(AdminService);
      const dto = { name: 'Plyometrics' };
      const expected = { id: 'c9', ...dto };
      (service.createCategory as jest.Mock).mockResolvedValue(expected);

      const result = await controller.createCategory(dto);

      expect(service.createCategory).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });

    it('updateCategory delegates to adminService.updateCategory with id and dto', async () => {
      const service = module.get(AdminService);
      const dto = { name: 'Cardio' };
      await controller.updateCategory('c1', dto);

      expect(service.updateCategory).toHaveBeenCalledWith('c1', dto);
    });

    it('deleteCategory passes force=true when the query param is "true"', async () => {
      const service = module.get(AdminService);
      await controller.deleteCategory('c1', 'true');

      expect(service.deleteCategory).toHaveBeenCalledWith('c1', true);
    });

    it('deleteCategory passes force=false when the query param is absent', async () => {
      const service = module.get(AdminService);
      await controller.deleteCategory('c1', undefined);

      expect(service.deleteCategory).toHaveBeenCalledWith('c1', false);
    });
  });
});
