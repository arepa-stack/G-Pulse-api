import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GITHUB_BASE_URL =
  'https://raw.githubusercontent.com/leip1493/g-pulse-exercise-db/refs/heads/main/exercises/';
const EXERCISES_JSON_URL =
  'https://raw.githubusercontent.com/leip1493/g-pulse-exercise-db/refs/heads/main/dist/exercises.json';

interface ExternalExercise {
  id: string; // "3_4_Sit-Up"
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

async function main() {
  console.log('Starting Seed...');
  console.log(`Fetching exercises from GitHub...`);

  const response = await fetch(EXERCISES_JSON_URL);
  if (!response.ok) {
    console.error(
      `Failed to fetch exercises.json: ${response.status} ${response.statusText}`,
    );
    process.exit(1);
  }

  const exercises: ExternalExercise[] =
    (await response.json()) as ExternalExercise[];
  console.log(`Found ${exercises.length} exercises.`);

  let createdCount = 0;

  for (const ex of exercises) {
    // 1. Upsert Category
    const categoryValid = ex.category || 'uncategorized';
    const category = await prisma.category.upsert({
      where: { name: categoryValid },
      update: {},
      create: { name: categoryValid },
    });

    // 2. Upsert Muscles
    const allMuscles = [
      ...new Set([...ex.primaryMuscles, ...ex.secondaryMuscles]),
    ];
    if (allMuscles.length === 0) allMuscles.push('general');

    // Create map of muscle name -> Muscle Record
    const muscleRecords: Record<string, any> = {};
    for (const mName of allMuscles) {
      const m = await prisma.muscle.upsert({
        where: { name: mName },
        update: {},
        create: { name: mName },
      });
      muscleRecords[mName] = m;
    }

    // 3. Create Exercise
    // Convert array instructions to string if schema requires string, or keep array if string[]
    // Schema: instructions String[]

    // Handle images
    const imageRecords: { url: string }[] = [];
    for (const imgPath of ex.images) {
      imageRecords.push({
        url: `${GITHUB_BASE_URL}${imgPath.replace(/\\/g, '/')}`,
      });
    }

    const exerciseData = {
      name: ex.name,
      difficulty: ex.level,
      mechanic: ex.mechanic,
      force: ex.force,
      equipment: ex.equipment,
      instructions: ex.instructions,
      categoryId: category.id,
      description: `Exercise: ${ex.name}`,
    };

    try {
      await prisma.exercise.upsert({
        where: { name: ex.name },
        update: {
          ...exerciseData,
          primaryMuscles: {
            set: [], // Clear existing
            connect: ex.primaryMuscles.map((m) => ({
              id: muscleRecords[m].id,
            })),
          },
          secondaryMuscles: {
            set: [],
            connect: ex.secondaryMuscles.map((m) => ({
              id: muscleRecords[m].id,
            })),
          },
          // We won't update images to avoid duplication or complex logic for now
        },
        create: {
          ...exerciseData,
          primaryMuscles: {
            connect: ex.primaryMuscles.map((m) => ({
              id: muscleRecords[m].id,
            })),
          },
          secondaryMuscles: {
            connect: ex.secondaryMuscles.map((m) => ({
              id: muscleRecords[m].id,
            })),
          },
          images: {
            create: imageRecords,
          },
        },
      });
      createdCount++;
    } catch (e) {
      console.error(`Failed to create exercise ${ex.name}:`, e);
    }
  }

  console.log(
    `Seed Complete: Processed ${exercises.length}, Created/Upserted ${createdCount}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
