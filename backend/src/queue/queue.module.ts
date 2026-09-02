import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
export const PARSE_QUEUE = 'pdf-parsing';
export const PARSE_QUEUE_TOKEN = 'PARSE_QUEUE';
@Module({ providers: [{ provide: PARSE_QUEUE_TOKEN, inject: [ConfigService], useFactory: (config: ConfigService) => new Queue(PARSE_QUEUE, { connection: { url: config.getOrThrow<string>('REDIS_URL') } }) }], exports: [PARSE_QUEUE_TOKEN] })
export class QueueModule {}
