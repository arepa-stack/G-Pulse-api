import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const exercises = [
    // Pecho
    { name: 'Press de Banca', primaryMuscles: ['Pecho'], equipment: 'Barra', difficulty: 'Intermedio', description: 'Ejercicio compuesto clásico para el desarrollo del pectoral.', category: 'Pecho' },
    { name: 'Aperturas con Mancuernas', primaryMuscles: ['Pecho'], equipment: 'Mancuernas', difficulty: 'Principiante', description: 'Ejercicio de aislamiento para el pecho.', category: 'Pecho' },
    { name: 'Flexiones', primaryMuscles: ['Pecho'], secondaryMuscles: ['Tríceps'], equipment: 'Peso Corporal', difficulty: 'Principiante', description: 'Ejercicio básico de empuje.', category: 'Pecho' },

    // Espalda
    { name: 'Dominadas', primaryMuscles: ['Espalda'], secondaryMuscles: ['Bíceps'], equipment: 'Barra', difficulty: 'Avanzado', description: 'Ejercicio fundamental para la espalda.', category: 'Espalda' },
    { name: 'Remo con Barra', primaryMuscles: ['Espalda'], equipment: 'Barra', difficulty: 'Intermedio', description: 'Construye densidad y fuerza en la espalda.', category: 'Espalda' },
    { name: 'Jalón al Pecho', primaryMuscles: ['Espalda'], equipment: 'Máquina', difficulty: 'Principiante', description: 'Alternativa a las dominadas.', category: 'Espalda' },

    // Piernas
    { name: 'Sentadilla', primaryMuscles: ['Cuádriceps', 'Glúteos'], secondaryMuscles: ['Isquiosurales'], equipment: 'Barra', difficulty: 'Avanzado', description: 'El rey de los ejercicios de pierna.', category: 'Piernas' },
    { name: 'Prensa de Piernas', primaryMuscles: ['Cuádriceps'], equipment: 'Máquina', difficulty: 'Principiante', description: 'Ejercicio compuesto seguro para cargar peso.', category: 'Piernas' },
    { name: 'Extensiones de Cuádriceps', primaryMuscles: ['Cuádriceps'], equipment: 'Máquina', difficulty: 'Principiante', description: 'Aislamiento de cuádriceps.', category: 'Piernas' },
    { name: 'Curl Femoral', primaryMuscles: ['Isquiosurales'], equipment: 'Máquina', difficulty: 'Principiante', description: 'Aislamiento de isquiosurales.', category: 'Piernas' },

    // Hombros
    { name: 'Press Militar', primaryMuscles: ['Hombros'], secondaryMuscles: ['Tríceps'], equipment: 'Barra', difficulty: 'Intermedio', description: 'Ejercicio compuesto para hombros fuertes.', category: 'Hombros' },
    { name: 'Elevaciones Laterales', primaryMuscles: ['Hombros'], equipment: 'Mancuernas', difficulty: 'Principiante', description: 'Aislamiento para la cabeza lateral del deltoides.', category: 'Hombros' },

    // Brazos
    { name: 'Curl de Bíceps con Barra', primaryMuscles: ['Bíceps'], equipment: 'Barra', difficulty: 'Principiante', description: 'Clásico para bíceps.', category: 'Brazos' },
    { name: 'Extensiones de Tríceps en Polea', primaryMuscles: ['Tríceps'], equipment: 'Cable', difficulty: 'Principiante', description: 'Aislamiento de tríceps.', category: 'Brazos' },
];

async function getOrCreateMuscle(name: string) {
    return prisma.muscle.upsert({
        where: { name },
        update: {},
        create: { name },
    });
}

async function getOrCreateCategory(name: string) {
    return prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
    });
}

async function main() {
    console.log('Seeding Exercises...');

    for (const ex of exercises) {
        const category = await getOrCreateCategory(ex.category);

        const primaryMuscles = await Promise.all(
            ex.primaryMuscles.map(getOrCreateMuscle),
        );
        const secondaryMuscles = await Promise.all(
            (ex.secondaryMuscles ?? []).map(getOrCreateMuscle),
        );

        const connectMuscles = (muscles: { id: string }[]) =>
            muscles.map((m) => ({ id: m.id }));

        await prisma.exercise.upsert({
            where: { name: ex.name },
            update: {
                description: ex.description,
                equipment: ex.equipment,
                difficulty: ex.difficulty,
                category: { connect: { id: category.id } },
                primaryMuscles: { set: connectMuscles(primaryMuscles) },
                secondaryMuscles: { set: connectMuscles(secondaryMuscles) },
            },
            create: {
                name: ex.name,
                description: ex.description,
                equipment: ex.equipment,
                difficulty: ex.difficulty,
                category: { connect: { id: category.id } },
                primaryMuscles: { connect: connectMuscles(primaryMuscles) },
                secondaryMuscles: { connect: connectMuscles(secondaryMuscles) },
            },
        });
        console.log(`Upserted exercise: ${ex.name}`);
    }

    console.log('Seeding complete.');
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
