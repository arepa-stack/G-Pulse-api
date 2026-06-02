import { PrismaClient, MediaType } from '@prisma/client';

const prisma = new PrismaClient();

const GITHUB_BASE_URL =
  'https://raw.githubusercontent.com/arepa-stack/exercises-dataset/main/';
const EXERCISES_JSON_URL =
  'https://raw.githubusercontent.com/arepa-stack/exercises-dataset/main/data/exercises.json';

interface NewExternalExercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: {
    en?: string;
    es?: string;
    it?: string;
    tr?: string;
  };
  instruction_steps: {
    en?: string[];
    es?: string[];
    it?: string[];
    tr?: string[];
  };
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  image: string;
  gif_url: string;
}

async function main() {
  console.log('Starting Seed for the new dataset structure (ES)...');
  console.log(`Fetching exercises from GitHub...`);

  const response = await fetch(EXERCISES_JSON_URL);
  if (!response.ok) {
    console.error(
      `Failed to fetch exercises.json: ${response.status} ${response.statusText}`,
    );
    process.exit(1);
  }

  const exercises: NewExternalExercise[] = (await response.json()) as NewExternalExercise[];
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
    const primaryMusclesArray = [ex.target];
    const secondaryMusclesArray = ex.secondary_muscles || [];
    
    const allMuscles = [
      ...new Set([...primaryMusclesArray, ...secondaryMusclesArray]),
    ];
    if (allMuscles.length === 0) allMuscles.push('general');

    const muscleRecords: Record<string, any> = {};
    for (const mName of allMuscles) {
      if (!mName) continue;
      const m = await prisma.muscle.upsert({
        where: { name: mName },
        update: {},
        create: { name: mName },
      });
      muscleRecords[mName] = m;
    }

    // 3. Handle images and GIFs as ExerciseMedia
    const mediaRecords: { url: string; type: MediaType }[] = [];
    if (ex.image) {
      mediaRecords.push({ url: `${GITHUB_BASE_URL}${ex.image}`, type: 'IMAGE' });
    }
    if (ex.gif_url) {
      mediaRecords.push({ url: `${GITHUB_BASE_URL}${ex.gif_url}`, type: 'GIF' });
    }

    // Use Spanish if available, fallback to English
    const instructionSteps = ex.instruction_steps?.es || ex.instruction_steps?.en || [];
    const descriptionText = ex.instructions?.es || ex.instructions?.en || `Exercise: ${ex.name}`;

    const exerciseData = {
      name: ex.name,
      equipment: ex.equipment,
      instructions: instructionSteps,
      categoryId: category.id,
      description: descriptionText,
    };

    try {
      await prisma.exercise.upsert({
        where: { name: ex.name },
        update: {
          ...exerciseData,
          primaryMuscles: {
            set: [], // Clear existing
            connect: primaryMusclesArray.filter(Boolean).map((m) => ({
              id: muscleRecords[m].id,
            })),
          },
          secondaryMuscles: {
            set: [],
            connect: secondaryMusclesArray.filter(Boolean).map((m) => ({
              id: muscleRecords[m].id,
            })),
          },
        },
        create: {
          ...exerciseData,
          primaryMuscles: {
            connect: primaryMusclesArray.filter(Boolean).map((m) => ({
              id: muscleRecords[m].id,
            })),
          },
          secondaryMuscles: {
            connect: secondaryMusclesArray.filter(Boolean).map((m) => ({
              id: muscleRecords[m].id,
            })),
          },
          media: {
            create: mediaRecords,
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
