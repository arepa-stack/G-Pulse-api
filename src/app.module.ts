import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join, resolve } from 'path';
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
import { ExerciseImagesModule } from './exercise-images/exercise-images.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRootAsync({
      useFactory: () => {
        const rootPath = resolve(__dirname, '..', '..', 'public');
        console.log('DEBUG: __dirname:', __dirname);
        console.log('DEBUG: rootPath resolved to:', rootPath);
        return [{
          rootPath,
          serveRoot: '/exercises',
        }];
      }
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    GeminiModule,
    ExercisesModule,
    RoutinesModule,
    ProgressModule,
    SubscriptionsModule,
    ExerciseImagesModule,
    AdminModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
