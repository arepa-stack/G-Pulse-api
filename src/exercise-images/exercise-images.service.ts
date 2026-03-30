import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Exercise {
    name: string;
    force: string;
    level: string;
    mechanic: string | null;
    equipment: string | null;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    instructions: string[];
    category: string;
    images: string[];
    id: string;
}

@Injectable()
export class ExerciseImagesService {
    private readonly logger = new Logger(ExerciseImagesService.name);
    private readonly githubBaseUrl = 'https://raw.githubusercontent.com/leip1493/g-pulse-exercise-db/refs/heads/main/exercises/';
    private cachedExercises: Exercise[] | null = null;

    private getExercisesFilePath(): string {
        const directPath = path.join(__dirname, 'exercises.json');
        if (fs.existsSync(directPath)) return directPath;

        // Handle NestJS build structure where compiled files are in dist/src/
        const distPath = path.join(__dirname, '..', '..', 'exercise-images', 'exercises.json');
        if (fs.existsSync(distPath)) return distPath;

        return directPath; // Fallback
    }

    private loadExercises(): Exercise[] {
        if (this.cachedExercises) return this.cachedExercises;

        const filePath = this.getExercisesFilePath();
        try {
            if (!fs.existsSync(filePath)) {
                this.logger.warn(`exercises.json not found at ${filePath}`);
                return [];
            }

            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const exercises: Exercise[] = JSON.parse(fileContent);

            this.cachedExercises = exercises.map((exercise) => ({
                ...exercise,
                images: exercise.images.map((img) => `${this.githubBaseUrl}${img}`),
            }));

            return this.cachedExercises;
        } catch (error) {
            this.logger.error('Error reading or parsing exercises.json', error);
            return [];
        }
    }

    getPaginatedExercises(page: number = 1, limit: number = 10) {
        const allExercises = this.loadExercises();
        const total = allExercises.length;

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        const data = allExercises.slice(startIndex, endIndex);
        const hasNextPage = endIndex < total;
        const hasPrevPage = page > 1;

        return {
            total,
            page,
            limit,
            hasNextPage,
            hasPrevPage,
            data,
        };
    }
}
