import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { createBullBoard } from '@bull-board/api';
import { AppModule } from './app.module';
import { PARSE_QUEUE_TOKEN } from './queue/queue.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN?.split(',');
  app.enableCors({
    origin: corsOrigin?.length ? corsOrigin : true,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerPath = process.env.SWAGGER_PATH ?? '/docs';
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SriPage API')
    .setDescription(
      'API for uploading PDFs, creating parsing jobs, and retrieving results.',
    )
    .setVersion('1.0')
    .addServer('/')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(swaggerPath, app, swaggerDocument, {
    jsonDocumentUrl: `${swaggerPath}-json`,
    customSiteTitle: 'SriPage API Documentation',
  });

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
