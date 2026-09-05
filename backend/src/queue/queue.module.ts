import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
export const PARSE_QUEUE = 'pdf-parsing';
export const PARSE_INGRESS_QUEUE = PARSE_QUEUE;
export const METHOD_QUEUE_PREFIX = 'pdf-parsing-';
export const PARSE_QUEUE_TOKEN = 'PARSE_QUEUE';
export const PARSE_INGRESS_QUEUE_TOKEN = 'PARSE_INGRESS_QUEUE';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();
  constructor(private readonly config: ConfigService) {}
  private create(name: string) {
    const existing = this.queues.get(name);
    if (existing) return existing;
    const queue = new Queue(name, {
      connection: { url: this.config.getOrThrow<string>('REDIS_URL') },
    });
    this.queues.set(name, queue);
    return queue;
  }
  ingress() {
    return this.create(PARSE_INGRESS_QUEUE);
  }
  method(method: string) {
    return this.create(`${METHOD_QUEUE_PREFIX}${method}`);
  }
  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}
@Module({
  providers: [
    QueueService,
    {
      provide: PARSE_QUEUE_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Queue(PARSE_QUEUE, {
          connection: { url: config.getOrThrow<string>('REDIS_URL') },
        }),
    },
    {
      provide: PARSE_INGRESS_QUEUE_TOKEN,
      useFactory: (queues: QueueService) => queues.ingress(),
      inject: [QueueService],
    },
  ],
  exports: [PARSE_QUEUE_TOKEN, PARSE_INGRESS_QUEUE_TOKEN, QueueService],
})
export class QueueModule {}
