import { GoogleGenerativeAI } from '@google/generative-ai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    private readonly PLAN_LIMITS = {
        'BASIC': 1,
        'PRO': 3,
        'EXPERT': 5,
        'FREE': 1, // Fallback for legacy
        'PREMIUM': 3 // Fallback for legacy
    };

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY') || 'placeholder_key';
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
    }

    async generateRoutine(promptData: any, userId?: string): Promise<any> {
        // Construct prompt from data
        const prompt = `Create a workout routine for muscle: ${promptData.muscle}, level: ${promptData.level}, equipment: ${promptData.equipment}. Format as JSON.`;

        return this.generateText(prompt, true, userId);
    }

    async generateRoutineJson(prompt: string): Promise<any> {
        const strictPrompt = `
            ${prompt}
            
            Strictly output valid JSON with this structure:
            {
                "exercises": [
                    {
                        "exerciseName": "Exercise Name",
                        "muscle": "Muscle Group (e.g. Chest, Back)",
                        "sets": 3,
                        "reps": 12,
                        "duration": null // in seconds, or null if reps based
                    }
                ]
            }
            Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
        `;

        try {
            const result = await this.model.generateContent(strictPrompt);
            const response = await result.response;
            const text = response.text();

            // Clean up if markdown is present despite instructions
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(cleaned);
        } catch (error) {
            console.error("Gemini Routine JSON Error", error);
            throw new HttpException('Failed to generate routine JSON', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async generateText(
        prompt: string,
        expectJson: boolean = false,
        userId?: string,
        forceUpdate: boolean = false,
        filters?: { muscle?: string }
    ): Promise<any> {
        // Mock response if no API key set
        if (!this.configService.get<string>('GEMINI_API_KEY')) {
            console.warn('Gemini API Key not found. Returning mock response.');
            return {
                text: "Mock response: API Key not found.",
                raw: "Mock response: API Key not found."
            };
        }

        if (!prompt) {
            throw new HttpException('Prompt is required', HttpStatus.BAD_REQUEST);
        }

        const normalizedPrompt = prompt.trim();

        // 1. Check Cache (if not forced)
        if (!forceUpdate) {
            try {
                const cached = await this.prisma.aiResponseCache.findUnique({
                    where: { prompt: normalizedPrompt }
                });

                if (cached) {
                    console.log('Returning cached response for prompt:', normalizedPrompt.substring(0, 50) + '...');
                    const content = expectJson ? this.parseResponse(cached.response) : { text: cached.response };
                    return {
                        ...content,
                        meta: {
                            isCached: true,
                            source: 'cache',
                            message: 'Respuesta recuperada del historial (Cache).'
                        }
                    };
                }
            } catch (error) {
                console.error('Cache lookup failed:', error);
            }
        }

        // 2. Check Quota (if userId provided)
        if (userId) {
            const canGenerate = await this.checkQuota(userId);
            if (!canGenerate) {
                // Fallback Logic: Search Database if filters provided
                if (filters?.muscle) {
                    console.log(`Quota exceeded for user ${userId}. Attempting DB fallback for muscle: ${filters.muscle}`);
                    const exercises = await this.prisma.exercise.findMany({
                        where: {
                            OR: [
                                { primaryMuscles: { some: { name: { contains: filters.muscle, mode: 'insensitive' } } } },
                                { secondaryMuscles: { some: { name: { contains: filters.muscle, mode: 'insensitive' } } } }
                            ]
                        },
                        take: 5,
                        include: { images: true }
                    });

                    if (exercises.length > 0) {
                        return {
                            data: exercises,
                            meta: {
                                isCached: false,
                                isFallback: true,
                                source: 'database',
                                message: `Límite diario alcanzado. Aquí tienes ${exercises.length} ejercicios de nuestra base de datos para ${filters.muscle}.`
                            }
                        };
                    }
                }

                throw new HttpException({
                    status: HttpStatus.TOO_MANY_REQUESTS,
                    error: 'Daily AI Limit Reached for your plan. Upgrade your plan or try again tomorrow.',
                    type: 'LIMIT_REACHED'
                }, HttpStatus.TOO_MANY_REQUESTS);
            }
        }

        // 3. Call Gemini API
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Increment Usage
            if (userId) {
                await this.incrementUsage(userId);
            }

            // Save/Update Cache (upsert for forceUpdate support)
            try {
                await this.prisma.aiResponseCache.upsert({
                    where: { prompt: normalizedPrompt },
                    update: { response: text },
                    create: {
                        prompt: normalizedPrompt,
                        response: text
                    }
                });
            } catch (cacheError) {
                console.warn('Failed to save response to cache:', cacheError);
            }

            const content = expectJson ? this.parseResponse(text) : { text };
            return {
                ...content,
                meta: {
                    isCached: false,
                    source: 'ai',
                    message: 'Respuesta generada por Gemini AI.'
                }
            };

        } catch (error: any) {
            console.error("Gemini API Error", error);

            // Check for Quota Exceeded (429)
            if (error.status === 429 || error.message?.includes('429')) {
                throw new HttpException({
                    status: HttpStatus.TOO_MANY_REQUESTS,
                    error: 'Gemini Quota Exceeded. Please try again later.',
                    details: error.response || error.message
                }, HttpStatus.TOO_MANY_REQUESTS);
            }

            throw new HttpException('Failed to generate content from Gemini', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private parseResponse(text: string) {
        // Basic cleaning of JSON markdown code blocks
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '');
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            return { raw: text };
        }
    }

    async checkQuota(userId: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return false;

        const now = new Date();
        const lastPrompt = new Date(user.lastAiPromptDate);

        // Check if it's a new day (simple check: different date string or > 24h?)
        // User implied "daily". Reset if date is different.
        const isNewDay = now.toDateString() !== lastPrompt.toDateString();

        if (isNewDay) {
            // Reset quota logic involves update
            await this.prisma.user.update({
                where: { id: userId },
                data: { aiPromptCount: 0, lastAiPromptDate: now }
            });
            // Treat as count 0
            return true; // 0 < limit
        }

        const limit = this.PLAN_LIMITS[user.plan] || 1;
        return user.aiPromptCount < limit;
    }

    async incrementUsage(userId: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                aiPromptCount: { increment: 1 },
                lastAiPromptDate: new Date()
            }
        });
    }
}
