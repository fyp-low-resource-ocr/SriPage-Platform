import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job as QueueJob, Worker } from 'bullmq';
import { Repository } from 'typeorm';
import { JobsService } from '../jobs/jobs.service';
import { Job } from '../jobs/job.entity';
import { PARSE_INGRESS_QUEUE, QueueService } from '../queue/queue.module';
import { ParserService } from '../parsers/parser.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private workers: Worker[] = [];
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Job) private readonly repo: Repository<Job>,
    private readonly jobs: JobsService,
    private readonly parsers: ParserService,
    private readonly storage: StorageService,
    private readonly queues: QueueService,
  ) {}
  onModuleInit() {
    if (this.config.get('WORKER_ENABLED', 'false') !== 'true') return;
    const connection = { url: this.config.getOrThrow<string>('REDIS_URL') };
    const concurrency = Number(this.config.get('WORKER_CONCURRENCY', 1));
    this.workers.push(
      new Worker(PARSE_INGRESS_QUEUE, (job) => this.dispatch(job), {
        connection,
        concurrency,
      }),
    );
    const configuredMethod = this.config.get<string>('WORKER_METHOD');
    const methods = configuredMethod
      ? [configuredMethod]
      : this.parsers.list().map((item) => item.method);
    for (const method of methods) {
      this.workers.push(
        new Worker(
          `${PARSE_INGRESS_QUEUE}-${method}`,
          (job) => this.process(job),
          { connection, concurrency },
        ),
      );
    }
  }
  private async dispatch(queueJob: QueueJob<{ jobId: string }>) {
    const job = await this.jobs.get(queueJob.data.jobId);
    await this.queues.method(job.method).add('parse-pdf', queueJob.data, {
      jobId: job.id,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
  private async process(queueJob: QueueJob<{ jobId: string }>) {
    const job = await this.jobs.get(queueJob.data.jobId);
    const claimed = await this.repo.update(
      { id: job.id, status: 'queued' },
      {
        status: 'processing',
        queuePosition: null,
      },
    );
    if (!claimed.affected) return;
    await this.jobs.refreshPositions();
    try {
      const output = await this.parsers.parse(job.method, job.runtime, {
        jobId: job.id,
        filename: job.filename,
        inputObjectKey: job.inputObjectKey,
        mimeType: job.mimeType,
      });
      const resultObjectKey = `results/${job.id}.json`;
      await this.storage.putJson(resultObjectKey, output);
      await this.jobs.update(job.id, {
        status: 'completed',
        result: output,
        resultObjectKey,
        queuePosition: null,
      });
    } catch (error) {
      await this.jobs.update(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Parsing failed',
        queuePosition: null,
      });
      throw error;
    } finally {
      await this.jobs.refreshPositions();
    }
  }
  async onModuleDestroy() {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }
}
