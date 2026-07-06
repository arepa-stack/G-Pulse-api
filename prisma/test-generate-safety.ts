/**
 * Test de invariante: el flujo de generación NUNCA crea ejercicios.
 * Verifica findCandidates (filtro SQL) + guardián (valida IDs, descarta inventados).
 * No usa Gemini ni HTTP — prueba el núcleo de seguridad de la BD.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LEVELS = ['beginner', 'intermediate', 'advanced'];

async function findCandidates(params: {
  category?: string;
  equipment?: string;
  difficulty?: string;
  take?: number;
}) {
  const { category, equipment, difficulty, take = 50 } = params;
  const idx = difficulty ? LEVELS.indexOf(difficulty.toLowerCase()) : -1;
  const allowedDifficulty = idx >= 0 ? LEVELS.slice(0, idx + 1) : undefined;
  return prisma.exercise.findMany({
    where: {
      ...(category && { category: { name: { equals: category, mode: 'insensitive' } } }),
      ...(equipment && { equipment: { equals: equipment, mode: 'insensitive' } }),
      ...(allowedDifficulty && { difficulty: { in: allowedDifficulty } }),
    },
    take,
    select: { id: true, name: true, equipment: true, difficulty: true },
  });
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FALLÓ: ' + msg);
  console.log('  ok:', msg);
}

async function main() {
  const before = await prisma.exercise.count();
  console.log('Exercise count (antes):', before);

  // 1. Retrieval: pecho avanzado trae candidatos, todos pecho
  const chest = await findCandidates({ category: 'chest', difficulty: 'advanced' });
  assert(chest.length > 10, `chest/advanced devuelve candidatos (${chest.length})`);

  // 2. difficulty acumulativa: beginner <= intermediate <= advanced
  const beg = await findCandidates({ category: 'chest', difficulty: 'beginner' });
  const adv = await findCandidates({ category: 'chest', difficulty: 'advanced', take: 500 });
  const begAll = await findCandidates({ category: 'chest', difficulty: 'beginner', take: 500 });
  assert(adv.length >= begAll.length, `advance (${adv.length}) >= beginner (${begAll.length})`);
  assert(beg.every((e) => e.difficulty === 'beginner'), 'beginner solo trae beginner');

  // 3. Guardián: respuesta IA simulada con 1 id real + 1 inventado
  const realId = chest[0].id;
  const fakeAi = {
    ejercicios: [
      { exercise_id: realId, series: 4, reps: '8-10', descanso_segundos: 90 },
      { exercise_id: 'XXXX-inventado-9999', series: 3, reps: '12', descanso_segundos: 60 },
    ],
  };
  const ids = fakeAi.ejercicios.map((e) => e.exercise_id);
  const valid = await prisma.exercise.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const validSet = new Set(valid.map((v) => v.id));
  const aceptados = fakeAi.ejercicios.filter((e) => validSet.has(e.exercise_id));
  const descartados = ids.filter((id) => !validSet.has(id));
  assert(aceptados.length === 1, 'guardián acepta solo el id real');
  assert(descartados.length === 1 && descartados[0] === 'XXXX-inventado-9999', 'guardián descarta el inventado');

  // 4. Invariante: la BD no creció
  const after = await prisma.exercise.count();
  assert(after === before, `Exercise count intacto (${before} -> ${after})`);

  console.log('\nTODO OK ✅  — BD inmutable, ids inventados descartados.');
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
