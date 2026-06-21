import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody:true so the signed payment webhook can verify the exact bytes.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API listening on :${port}`);
}

void bootstrap();
