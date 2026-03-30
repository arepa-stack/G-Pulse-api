
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.exercise.count();
    console.log(`Total Exercises: ${count}`);

    const withImages = await prisma.exercise.count({
        where: { images: { some: {} } }
    });
    console.log(`Exercises with Images: ${withImages}`);

    /*
  const sample = await prisma.exercise.findFirst({
      where: { images: { some: {} } },
      include: { images: true, category: true, primaryMuscles: true }
  });
  console.log('Sample Exercise:', JSON.stringify(sample, null, 2));
  */

    /*
  const muscles = await prisma.muscle.findMany({ select: { name: true } });
  console.log('Muscles:', muscles.map(m => m.name).sort());
  */

    /*
  const levels = await prisma.exercise.findMany({ select: { difficulty: true }, distinct: ['difficulty'] });
  console.log('Levels:', levels.map(l => l.difficulty));
  */

    const chestBeginner = await prisma.exercise.findMany({
        where: {
            difficulty: 'beginner',
            OR: [
                { primaryMuscles: { some: { name: 'chest' } } },
                { secondaryMuscles: { some: { name: 'chest' } } }
            ]
        },
        take: 10,
        include: { images: true }
    });

    console.log(`Found ${chestBeginner.length} Beginner Chest exercises.`);
    if (chestBeginner.length > 0) {
        console.log('Sample:', JSON.stringify(chestBeginner[0], null, 2));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
