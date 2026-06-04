import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { GeminiModule } from './gemini/gemini.module';
import { ExercisesModule } from './exercises/exercises.module';
import { RoutinesModule } from './routines/routines.module';
import { ProgressModule } from './progress/progress.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';
import { DictionariesModule } from './dictionaries/dictionaries.module';
import { StorageModule } from './storage/storage.module';
import { ExerciseImagesModule } from './exercise-images/exercise-images.module';
import { GoalsModule } from './goals/goals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    GeminiModule,
    ExercisesModule,
    RoutinesModule,
    ProgressModule,
    SubscriptionsModule,
    AdminModule,
    MailModule,
    DictionariesModule,
    StorageModule,
    ExerciseImagesModule,
    GoalsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
