import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job as QueueJob, Worker } from 'bullmq';
import { Repository } from 'typeorm';
import { JobsService } from '../jobs/jobs.service';
import { Job } from '../jobs/job.entity';
import { PARSE_QUEUE } from '../queue/queue.module';
import { ParserService } from '../parsers/parser.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  constructor(private readonly config: ConfigService, @InjectRepository(Job) private readonly repo: Repository<Job>, private readonly jobs: JobsService, private readonly parsers: ParserService, private readonly storage: StorageService) {}
  onModuleInit() {
    if (this.config.get('WORKER_ENABLED', 'false') !== 'true') return;
    this.worker = new Worker(PARSE_QUEUE, async (queueJob) => this.process(queueJob), { connection: { url: this.config.getOrThrow('REDIS_URL') }, concurrency: Number(this.config.get('WORKER_CONCURRENCY', 1)) });
  }
  private async process(queueJob: QueueJob<{ jobId: string }>) {
    const job = await this.jobs.get(queueJob.data.jobId);
    await this.jobs.update(job.id, { status: 'processing', queuePosition: null });
    await this.jobs.refreshPositions();
    try {
      const output = await this.parsers.parse(job.method, job.runtime, { jobId: job.id, filename: job.filename, inputObjectKey: job.inputObjectKey, mimeType: job.mimeType });
      const resultObjectKey = `results/${job.id}.json`;
      await this.storage.putJson(resultObjectKey, output);
      await this.jobs.update(job.id, { status: 'completed', result: output, resultObjectKey, queuePosition: null });
    } catch (error) {
      await this.jobs.update(job.id, { status: 'failed', error: error instanceof Error ? error.message : 'Parsing failed', queuePosition: null });
      throw error;
    } finally {
      await this.jobs.refreshPositions();
    }
  }
  async onModuleDestroy() { await this.worker?.close(); }
}
