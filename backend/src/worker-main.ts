import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { AppModule } from './app.module';
import { WorkerModule } from './workers/worker.module';
@Module({ imports: [AppModule, WorkerModule] })
class WorkerAppModule {}

async function bootstrap() {
  process.env.WORKER_ENABLED = 'true';
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  app.enableShutdownHooks();
}
void bootstrap();
