import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.enableCors(); // Enable CORS for development

  const config = new DocumentBuilder()
    .setTitle('G-Pulse API')
    .setDescription('The G-Pulse API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);

  Logger.log(`🚀 Application is running on: ${await app.getUrl()}`);
  Logger.log(`🚀 Swagger is running on: ${await app.getUrl()}/api/docs`);
}
bootstrap();
