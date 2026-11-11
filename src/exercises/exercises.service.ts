import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExercisesService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ExerciseCreateInput) {
    return this.prisma.exercise.create({ data });
  }

  // Retrieval (RAG) determinístico: filtro grueso por columnas antes de llamar a la IA.
  // Devuelve solo lo mínimo que la IA necesita para elegir por id.
  private static readonly LEVELS = ['beginner', 'intermediate', 'advanced'];

  // Red de seguridad: la IA a veces devuelve el equipo en español. Mapeamos a los valores
  // reales de la columna `equipment`. Si no matchea, se devuelve tal cual (puede venir en inglés).
  private static readonly EQUIPMENT_ES: Record<string, string> = {
    mancuerna: 'dumbbell', mancuernas: 'dumbbell',
    barra: 'barbell', 'barra ez': 'ez barbell',
    polea: 'cable', poleas: 'cable', cable: 'cable',
    'peso corporal': 'body weight', corporal: 'body weight', 'sin equipo': 'body weight',
    maquina: 'leverage machine', máquina: 'leverage machine',
    'maquina smith': 'smith machine', smith: 'smith machine',
    'pesa rusa': 'kettlebell', kettlebell: 'kettlebell',
    banda: 'band', 'banda de resistencia': 'resistance band',
  };

  // "gimnasio/gym/todo/completo" = acceso a todo el equipo -> NO filtrar por equipo.
  private static readonly ALL_EQUIPMENT = new Set([
    'gimnasio', 'gym', 'gimnasio completo', 'gym completo', 'full gym',
    'todo', 'todos', 'cualquiera', 'all', 'completo',
  ]);

  private normalizeEquipment(equipment?: string): string | undefined {
    if (!equipment) return undefined;
    const key = equipment.trim().toLowerCase();
    if (ExercisesService.ALL_EQUIPMENT.has(key)) return undefined;
    return ExercisesService.EQUIPMENT_ES[key] ?? equipment;
  }

  async findCandidates(params: {
    category?: string;
    equipment?: string;
    difficulty?: string;
    take?: number;
  }) {
    const { category, equipment, difficulty, take = 50 } = params;

    // difficulty acumulativa: 'advanced' incluye todo; 'intermediate' incluye beginner+intermediate.
    // 'beginner' también incluye intermediate: el dataset etiquetó por EQUIPO, no por ejercicio
    // (toda mancuerna/barra/cable/smith = intermediate, 0 beginner), así que solo 'beginner'
    // dejaba a principiantes sin pesos libres. Se excluye solo 'advanced'; la IA generadora
    // recibe difficulty y elige los simples. ponytail: reetiquetar el dataset y quitar esto.
    const idx = difficulty
      ? ExercisesService.LEVELS.indexOf(difficulty.toLowerCase())
      : -1;
    const allowedDifficulty =
      idx >= 0 ? ExercisesService.LEVELS.slice(0, Math.max(idx, 1) + 1) : undefined;

    const equipmentNorm = this.normalizeEquipment(equipment);
    const where: Prisma.ExerciseWhereInput = {
      ...(category && {
        category: { name: { equals: category, mode: 'insensitive' } },
      }),
      ...(equipmentNorm && {
        equipment: { equals: equipmentNorm, mode: 'insensitive' },
      }),
      ...(allowedDifficulty && { difficulty: { in: allowedDifficulty } }),
    };

    return this.prisma.exercise.findMany({
      where,
      take,
      select: {
        id: true,
        name: true,
        equipment: true,
        difficulty: true,
        primaryMuscles: { select: { name: true, target: true } },
      },
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ExerciseWhereUniqueInput;
    where?: Prisma.ExerciseWhereInput;
    orderBy?: Prisma.ExerciseOrderByWithRelationInput;
    search?: string;
    user?: { id: string; role: string };
  }) {
    const { skip, take, cursor, where = {}, orderBy, search, user } = params;

    if (search) {
      const matchingExercises = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Exercise"
        WHERE "name"->>'en' ILIKE ${`%${search}%`}
           OR "name"->>'es' ILIKE ${`%${search}%`}
           OR "name"->>'it' ILIKE ${`%${search}%`}
           OR "name"->>'tr' ILIKE ${`%${search}%`}
      `;
      const ids = matchingExercises.map((e) => e.id);
      where.id = { in: ids };
    }

    const mediaFilter =
      user?.role === 'ADMIN'
        ? true
        : {
            where: {
              isPaused: false,
              OR: [
                { userId: null },
                { isPublic: true },
                ...(user?.id ? [{ userId: user.id }] : []),
              ],
            },
          };

    return this.prisma.exercise.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        media: mediaFilter,
        primaryMuscles: true,
        secondaryMuscles: true,
        category: true,
      },
    });
  }

  async findOne(id: string, user?: { id: string; role: string }) {
    const mediaFilter =
      user?.role === 'ADMIN'
        ? true
        : {
            where: {
              isPaused: false,
              OR: [
                { userId: null },
                { isPublic: true },
                ...(user?.id ? [{ userId: user.id }] : []),
              ],
            },
          };

    return this.prisma.exercise.findUnique({
      where: { id },
      include: {
        media: mediaFilter,
        primaryMuscles: true,
        secondaryMuscles: true,
        category: true,
      },
    });
  }
}
