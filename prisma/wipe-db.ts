import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB Wipe for Exercises...');
  
  // Borrar en orden para respetar las restricciones de llaves foráneas (si las hay)
  await prisma.exerciseMedia.deleteMany();
  await prisma.workoutSet.deleteMany();
  await prisma.routineExercise.deleteMany();
  
  // Ahora podemos borrar los ejercicios
  await prisma.exercise.deleteMany();
  
  // Finalmente las categorías y los músculos
  await prisma.muscle.deleteMany();
  await prisma.category.deleteMany();

  console.log('Wipe Complete! All exercise data has been deleted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
