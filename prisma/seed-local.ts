import { PrismaClient, MediaType, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const GITHUB_BASE_URL =
  'https://raw.githubusercontent.com/arepa-stack/exercises-dataset/main/';

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
  thumbnail?: string | null;
  images_leip?: string[] | null;
}

async function main() {
  console.log('Starting Seed for the new dataset structure (ES) from local files...');
  
  await seedDictionaries();

  console.log(`Reading exercises from local dataset...`);

  const exercisesPath = path.resolve(__dirname, '../../dataSet/exercises-dataset/data/exercises.json');
  if (!fs.existsSync(exercisesPath)) {
    console.error(`Local exercises.json not found at: ${exercisesPath}`);
    process.exit(1);
  }

  const exercises: NewExternalExercise[] = JSON.parse(fs.readFileSync(exercisesPath, 'utf8')) as NewExternalExercise[];
  console.log(`Found ${exercises.length} exercises.`);

  let createdCount = 0;
  const categoryCache = new Map<string, any>();
  const muscleCache = new Map<string, any>();

  for (const ex of exercises) {
    // 1. Upsert Category
    const categoryValid = ex.category || 'uncategorized';
    let category;
    if (categoryCache.has(categoryValid)) {
      category = categoryCache.get(categoryValid);
    } else {
      category = await prisma.category.upsert({
        where: { name: categoryValid },
        update: {},
        create: { name: categoryValid },
      });
      categoryCache.set(categoryValid, category);
    }

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
      if (muscleCache.has(mName)) {
        muscleRecords[mName] = muscleCache.get(mName);
      } else {
        const m = await prisma.muscle.upsert({
          where: { name: mName },
          update: {},
          create: { name: mName },
        });
        muscleCache.set(mName, m);
        muscleRecords[mName] = m;
      }
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
      thumbnail: ex.thumbnail ?? null,
      images_leip: ex.images_leip ? (ex.images_leip as any) : Prisma.DbNull,
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
      if (createdCount % 50 === 0) {
        console.log(`Processed ${createdCount}/${exercises.length} exercises...`);
      }
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
  console.log('Reading dictionaries from local dataset...');
  const dictPath = path.resolve(__dirname, '../../dataSet/exercises-dataset/data/dictionaries.json');
  if (!fs.existsSync(dictPath)) {
    console.error(`Local dictionaries.json not found at: ${dictPath}`);
    process.exit(1);
  }

  const dictData = JSON.parse(fs.readFileSync(dictPath, 'utf8')) as Record<string, Record<string, Record<string, string>>>;
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
