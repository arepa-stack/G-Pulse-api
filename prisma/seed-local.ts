import { PrismaClient, MediaType } from '@prisma/client';

const prisma = new PrismaClient();

const GITHUB_BASE_URL =
  'https://raw.githubusercontent.com/arepa-stack/exercises-dataset/main/';
const EXERCISES_JSON_URL =
  'https://raw.githubusercontent.com/arepa-stack/exercises-dataset/main/data/exercises.json';
const DICTIONARIES_JSON_URL =
  'https://raw.githubusercontent.com/arepa-stack/exercises-dataset/main/data/dictionaries.json';

interface NewExternalExercise {
  id: string;
  name: {
    en?: string;
    es?: string;
    it?: string;
    tr?: string;
  };
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
  
  await seedDictionaries();

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

    const exerciseData = {
      name: ex.name,
      equipment: ex.equipment,
      instructions: ex.instruction_steps,
      categoryId: category.id,
      description: ex.instructions,
    };

    try {
      await prisma.exercise.upsert({
        where: { id: ex.id },
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
          id: ex.id,
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
      const displayName = ex.name?.en || ex.name?.es || ex.id;
      console.error(`Failed to create exercise ${displayName}:`, e);
    }
  }

  console.log(
    `Seed Complete: Processed ${exercises.length}, Created/Upserted ${createdCount}.`,
  );
}

async function seedDictionaries() {
  console.log('Fetching dictionaries from GitHub...');
  const response = await fetch(DICTIONARIES_JSON_URL);
  if (!response.ok) {
    console.error(
      `Failed to fetch dictionaries.json: ${response.status} ${response.statusText}`,
    );
    process.exit(1);
  }

  const dictData = (await response.json()) as Record<string, Record<string, Record<string, string>>>;
  console.log('Seeding dictionaries...');

  let count = 0;
  for (const [type, keys] of Object.entries(dictData)) {
    for (const [key, translations] of Object.entries(keys)) {
      await prisma.dictionary.upsert({
        where: {
          type_key: {
            type,
            key,
          },
        },
        update: {
          translations,
        },
        create: {
          type,
          key,
          translations,
        },
      });
      count++;
    }
  }
  console.log(`Dictionaries seed complete: ${count} entries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
