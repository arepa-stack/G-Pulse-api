import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    muscle: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    category: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      muscle: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---- MUSCLES (F-14 / Fibery #69) ----

  describe('findAllMuscles', () => {
    it('returns muscles ordered by name with primary/secondary exercise counts', async () => {
      const muscles = [
        {
          id: 'm1',
          name: 'Biceps',
          target: 'arms',
          _count: { primaryExercises: 2, secondaryExercises: 0 },
        },
      ];
      prisma.muscle.findMany.mockResolvedValue(muscles);

      const result = await service.findAllMuscles();

      expect(prisma.muscle.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { primaryExercises: true, secondaryExercises: true },
          },
        },
      });
      expect(result).toEqual(muscles);
    });
  });

  describe('createMuscle', () => {
    it('creates a muscle', async () => {
      const dto = { name: 'Forearms', target: 'arms' };
      const created = { id: 'm2', ...dto };
      prisma.muscle.create.mockResolvedValue(created);

      const result = await service.createMuscle(dto);

      expect(prisma.muscle.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual(created);
    });

    it('throws ConflictException when name already exists (Prisma P2002)', async () => {
      prisma.muscle.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.createMuscle({ name: 'Biceps' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows unknown errors', async () => {
      prisma.muscle.create.mockRejectedValue(new Error('db down'));

      await expect(service.createMuscle({ name: 'X' })).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('updateMuscle', () => {
    it('throws NotFoundException when the muscle does not exist', async () => {
      prisma.muscle.findUnique.mockResolvedValue(null);

      await expect(service.updateMuscle('nope', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.muscle.update).not.toHaveBeenCalled();
    });

    it('updates an existing muscle', async () => {
      prisma.muscle.findUnique.mockResolvedValue({ id: 'm1', name: 'biceps' });
      const updated = { id: 'm1', name: 'Biceps' };
      prisma.muscle.update.mockResolvedValue(updated);

      const result = await service.updateMuscle('m1', { name: 'Biceps' });

      expect(prisma.muscle.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { name: 'Biceps' },
      });
      expect(result).toEqual(updated);
    });

    it('throws ConflictException when renaming to an existing name (P2002)', async () => {
      prisma.muscle.findUnique.mockResolvedValue({ id: 'm1', name: 'biceps' });
      prisma.muscle.update.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.updateMuscle('m1', { name: 'Triceps' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteMuscle', () => {
    it('throws NotFoundException when the muscle does not exist', async () => {
      prisma.muscle.findUnique.mockResolvedValue(null);

      await expect(service.deleteMuscle('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException with reference count when in use and force is false', async () => {
      prisma.muscle.findUnique.mockResolvedValue({
        id: 'm1',
        name: 'Biceps',
        _count: { primaryExercises: 2, secondaryExercises: 1 },
      });

      await expect(service.deleteMuscle('m1', false)).rejects.toThrow(
        ConflictException,
      );

      const error: unknown = await service
        .deleteMuscle('m1', false)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        references: 3,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('disconnects M:N relations and deletes (in a transaction) when force is true', async () => {
      prisma.muscle.findUnique.mockResolvedValue({
        id: 'm1',
        name: 'Biceps',
        _count: { primaryExercises: 2, secondaryExercises: 1 },
      });

      const result = await service.deleteMuscle('m1', true);

      expect(prisma.muscle.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: {
          primaryExercises: { set: [] },
          secondaryExercises: { set: [] },
        },
      });
      expect(prisma.muscle.delete).toHaveBeenCalledWith({
        where: { id: 'm1' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Muscle deleted successfully' });
    });

    it('deletes directly when the muscle is not referenced', async () => {
      prisma.muscle.findUnique.mockResolvedValue({
        id: 'm1',
        name: 'Biceps',
        _count: { primaryExercises: 0, secondaryExercises: 0 },
      });

      const result = await service.deleteMuscle('m1');

      expect(prisma.muscle.delete).toHaveBeenCalledWith({
        where: { id: 'm1' },
      });
      expect(result).toEqual({ message: 'Muscle deleted successfully' });
    });
  });

  // ---- CATEGORIES (F-14 / Fibery #70) ----

  describe('findAllCategories', () => {
    it('returns categories ordered by name with exercise counts', async () => {
      const categories = [
        { id: 'c1', name: 'Strength', _count: { exercises: 4 } },
      ];
      prisma.category.findMany.mockResolvedValue(categories);

      const result = await service.findAllCategories();

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: { _count: { select: { exercises: true } } },
      });
      expect(result).toEqual(categories);
    });
  });

  describe('createCategory', () => {
    it('creates a category', async () => {
      const dto = { name: 'Plyometrics' };
      const created = { id: 'c2', ...dto };
      prisma.category.create.mockResolvedValue(created);

      const result = await service.createCategory(dto);

      expect(prisma.category.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual(created);
    });

    it('throws ConflictException when name already exists (Prisma P2002)', async () => {
      prisma.category.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.createCategory({ name: 'Strength' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rethrows unknown errors', async () => {
      prisma.category.create.mockRejectedValue(new Error('db down'));

      await expect(service.createCategory({ name: 'X' })).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('updateCategory', () => {
    it('throws NotFoundException when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCategory('nope', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('updates an existing category', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'strength',
      });
      const updated = { id: 'c1', name: 'Strength' };
      prisma.category.update.mockResolvedValue(updated);

      const result = await service.updateCategory('c1', { name: 'Strength' });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { name: 'Strength' },
      });
      expect(result).toEqual(updated);
    });

    it('throws ConflictException when renaming to an existing name (P2002)', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'strength',
      });
      prisma.category.update.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.updateCategory('c1', { name: 'Cardio' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteCategory', () => {
    it('throws NotFoundException when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.deleteCategory('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException with reference count when in use and force is false', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Strength',
        _count: { exercises: 5 },
      });

      await expect(service.deleteCategory('c1', false)).rejects.toThrow(
        ConflictException,
      );

      const error: unknown = await service
        .deleteCategory('c1', false)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        references: 5,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('detaches exercises (categoryId=null) and deletes (in a transaction) when force is true', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Strength',
        _count: { exercises: 5 },
      });

      const result = await service.deleteCategory('c1', true);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { exercises: { set: [] } },
      });
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Category deleted successfully' });
    });

    it('deletes directly when the category is not referenced', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Strength',
        _count: { exercises: 0 },
      });

      const result = await service.deleteCategory('c1');

      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
      expect(result).toEqual({ message: 'Category deleted successfully' });
    });
  });
});
