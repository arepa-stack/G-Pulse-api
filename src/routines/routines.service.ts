import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';

@Injectable()
export class RoutinesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly geminiService: GeminiService
    ) { }

    async createRoutine(data: any) {
        // Basic validation
        if (!data.name || !data.userId) {
            throw new HttpException('Name and userId are required', HttpStatus.BAD_REQUEST);
        }

        let exercises = data.exercises || [];

        // AI Generation Logic
        if (data.fromAi && data.aiPrompt) {
            console.log(`Generating routine from AI: ${data.aiPrompt}`);
            const aiResponse = await this.geminiService.generateRoutineJson(data.aiPrompt);

            if (aiResponse && Array.isArray(aiResponse.exercises)) {
                exercises = aiResponse.exercises;
            }
        }

        // Create Routine Header
        const routine = await this.prisma.routine.create({
            data: {
                name: data.name,
                description: data.description,
                isPublic: !!data.isPublic,
                creatorId: data.userId
            }
        });

        // Process Exercises
        for (let i = 0; i < exercises.length; i++) {
            const exData = exercises[i];

            // Upsert Exercise (ensure it exists)
            let exercise = await this.prisma.exercise.findFirst({
                where: { name: exData.exerciseName }
            });

            if (!exercise) {
                // If AI suggests an exercise not in DB, we create a placeholder. 
                // However, our new schema requires relation to Category/Muscle.
                // For simplicity in AI generation flow, we can try to find 'general' muscle/category or create them if needed.
                // Or just skimp on relations for now if optional? 
                // Schema: categoryId optional, muscles uses join table.

                // Let's attach 'General' muscle if exists, or create it.
                // This is a bit complex for a quick fix, so let's check if we can just create with minimal info.
                // Exercise needs: name. Others are optional or arrays.

                exercise = await this.prisma.exercise.create({
                    data: {
                        name: exData.exerciseName,
                        description: 'AI Generated',
                        // We can leave muscles empty or try to connect if we mapped names. 
                        // For now, leave empty to avoid errors.
                    }
                });
            }

            // Link to Routine
            await this.prisma.routineExercise.create({
                data: {
                    routineId: routine.id,
                    exerciseId: exercise.id,
                    order: i + 1,
                    sets: exData.sets || 3,
                    reps: exData.reps || 10,
                    duration: exData.duration
                }
            });
        }

        return this.prisma.routine.findUnique({
            where: { id: routine.id },
            include: {
                exercises: {
                    include: { exercise: true }
                }
            }
        });
    }
}
