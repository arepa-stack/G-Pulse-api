import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GITHUB_BASE_URL =
  'https://raw.githubusercontent.com/leip1493/g-pulse-exercise-db/refs/heads/main/exercises/';
const LOCAL_PREFIX = '/exercises/';

async function main() {
  console.log('Starting image URL migration to GitHub CDN...');

  const images = await prisma.exerciseImage.findMany();
  console.log(`Found ${images.length} ExerciseImage records.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const image of images) {
    if (image.url.startsWith('https://')) {
      skippedCount++;
      continue;
    }

    if (image.url.startsWith(LOCAL_PREFIX)) {
      const relativePath = image.url.slice(LOCAL_PREFIX.length);
      const newUrl = `${GITHUB_BASE_URL}${relativePath}`;
      await prisma.exerciseImage.update({
        where: { id: image.id },
        data: { url: newUrl },
      });
      updatedCount++;
    } else {
      console.warn(`Unexpected URL format, skipping: ${image.url}`);
      skippedCount++;
    }
  }

  console.log(
    `Migration complete. Updated: ${updatedCount}, Skipped: ${skippedCount}.`,
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
