import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { createBullBoard } from '@bull-board/api';
import { AppModule } from './app.module';
import { PARSE_QUEUE_TOKEN } from './queue/queue.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (process.env.BULL_BOARD_ENABLED !== 'false') {
    const serverAdapter = new ExpressAdapter();
    const bullBoardPath = process.env.BULL_BOARD_PATH ?? '/admin/queues';
    serverAdapter.setBasePath(bullBoardPath);
    createBullBoard({
      queues: [new BullMQAdapter(app.get(PARSE_QUEUE_TOKEN))],
      serverAdapter,
    });
    app.use(bullBoardPath, serverAdapter.getRouter());
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
