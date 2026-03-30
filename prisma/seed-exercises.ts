import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Exercises...');

    const exercises = [
        // Pecho
        { name: 'Press de Banca', muscle: 'Pecho', equipment: 'Barra', difficulty: 'Intermedio', description: 'Ejercicio compuesto clásico para el desarrollo del pectoral.' },
        { name: 'Aperturas con Mancuernas', muscle: 'Pecho', equipment: 'Mancuernas', difficulty: 'Principiante', description: 'Ejercicio de aislamiento para el pecho.' },
        { name: 'Flexiones', muscle: 'Pecho', equipment: 'Peso Corporal', difficulty: 'Principiante', description: 'Ejercicio básico de empuje.' },

        // Espalda
        { name: 'Dominadas', muscle: 'Espalda', equipment: 'Barra', difficulty: 'Avanzado', description: 'Ejercicio fundamental para la espalda.' },
        { name: 'Remo con Barra', muscle: 'Espalda', equipment: 'Barra', difficulty: 'Intermedio', description: 'Construye densidad y fuerza en la espalda.' },
        { name: 'Jalón al Pecho', muscle: 'Espalda', equipment: 'Máquina', difficulty: 'Principiante', description: 'Alternativa a las dominadas.' },

        // Piernas
        { name: 'Sentadilla', muscle: 'Piernas', equipment: 'Barra', difficulty: 'Avanzado', description: 'El rey de los ejercicios de pierna.' },
        { name: 'Prensa de Piernas', muscle: 'Piernas', equipment: 'Máquina', difficulty: 'Principiante', description: 'Ejercicio compuesto seguro para cargar peso.' },
        { name: 'Extensiones de Cuádriceps', muscle: 'Piernas', equipment: 'Máquina', difficulty: 'Principiante', description: 'Aislamiento de cuádriceps.' },
        { name: 'Curl Femoral', muscle: 'Piernas', equipment: 'Máquina', difficulty: 'Principiante', description: 'Aislamiento de isquiosurales.' },

        // Hombros
        { name: 'Press Militar', muscle: 'Hombros', equipment: 'Barra', difficulty: 'Intermedio', description: 'Ejercicio compuesto para hombros fuertes.' },
        { name: 'Elevaciones Laterales', muscle: 'Hombros', equipment: 'Mancuernas', difficulty: 'Principiante', description: 'Aislamiento para la cabeza lateral del deltoides.' },

        // Brazos
        { name: 'Curl de Bíceps con Barra', muscle: 'Bíceps', equipment: 'Barra', difficulty: 'Principiante', description: 'Clásico para bíceps.' },
        { name: 'Extensiones de Tríceps en Polea', muscle: 'Tríceps', equipment: 'Cable', difficulty: 'Principiante', description: 'Aislamiento de tríceps.' }
    ];

    for (const ex of exercises) {
        // Simple distinct check by name to avoid duplicates
        const exists = await prisma.exercise.findFirst({ where: { name: ex.name } });
        if (!exists) {
            await prisma.exercise.create({ data: ex });
            console.log(`Created exercise: ${ex.name}`);
        } else {
            console.log(`Exercise exists: ${ex.name}`);
        }
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
