import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { ParserService } from '../parsers/parser.service';
import { QueueService } from '../queue/queue.module';
import { StorageService } from '../storage/storage.service';
import { CreateJobDto, PresignUploadDto } from './jobs.dto';
import { Job } from './job.entity';
import { AnonymousSessionService } from './anonymous-session.service';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private readonly repo: Repository<Job>,
    private readonly queues: QueueService,
    private readonly storage: StorageService,
    private readonly parsers: ParserService,
    private readonly sessions: AnonymousSessionService,
  ) {}
  async presign(dto: PresignUploadDto, ownerHash: string) {
    const safeName = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `inputs/${ownerHash}/${randomUUID()}-${safeName}`;
    return {
      objectKey,
      uploadUrl: await this.storage.presignUpload(objectKey),
    };
  }
  async create(dto: CreateJobDto, ownerHash: string) {
    if (!this.sessions.objectKeyBelongsToOwner(dto.inputObjectKey, ownerHash))
      throw new BadRequestException('Upload does not belong to this browser');
    const parser = this.parsers.get(dto.method);
    const runtime = parser.supportedRuntimes[0] ?? 'cpu';
    const job = await this.repo.save(
      this.repo.create({
        ...dto,
        ownerTokenHash: ownerHash,
        runtime,
        status: 'queued',
        queuePosition: null,
        result: null,
        error: null,
        resultObjectKey: null,
      }),
    );
    await this.queues
      .ingress()
      .add(
        'parse-pdf',
        { jobId: job.id },
        { jobId: job.id, removeOnComplete: 100, removeOnFail: 100 },
      );
    await this.refreshPositions();
    return this.get(job.id, ownerHash);
  }
  async list(ownerHash: string) {
    await this.refreshPositions();
    return this.repo.find({
      where: { ownerTokenHash: ownerHash },
      order: { createdAt: 'DESC' },
    });
  }
  async get(id: string, ownerHash?: string) {
    const job = ownerHash
      ? await this.repo.findOneBy({ id, ownerTokenHash: ownerHash })
      : await this.repo.findOneBy({ id });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }
  async getResultUrl(id: string, ownerHash: string) {
    const job = await this.get(id, ownerHash);
    if (!job.resultObjectKey)
      throw new NotFoundException('Result is not ready');
    return { url: await this.storage.presignDownload(job.resultObjectKey) };
  }
  async cancel(id: string, ownerHash: string) {
    const job = await this.get(id, ownerHash);
    if (job.status !== 'queued') {
      throw new ConflictException(
        job.status === 'processing'
          ? 'A job cannot be cancelled while it is processing'
          : 'Only queued jobs can be cancelled',
      );
    }

    // The conditional update makes cancellation and worker pickup mutually
    // exclusive when both happen at nearly the same time.
    const result = await this.repo.update(
      { id, ownerTokenHash: ownerHash, status: 'queued' },
      { status: 'cancelled', queuePosition: null },
    );
    if (!result.affected) {
      throw new ConflictException('The job is no longer queued');
    }

    for (const queue of [
      this.queues.ingress(),
      this.queues.method(job.method),
    ]) {
      const queueJob = await queue.getJob(id);
      if (queueJob) {
        try {
          await queueJob.remove();
        } catch {
          // A worker may have claimed the Redis job. The guarded database
          // claim observes `cancelled` and exits without parsing it.
        }
      }
    }
    await this.refreshPositions();
    return this.get(id, ownerHash);
  }
  async update(id: string, values: Partial<Job>) {
    await this.repo.update(id, values as QueryDeepPartialEntity<Job>);
    return this.get(id);
  }
  async refreshPositions() {
    const queued = await this.repo.find({
      where: { status: 'queued' },
      order: { createdAt: 'ASC' },
    });
    await Promise.all(
      queued.map((job, index) =>
        this.repo.update(job.id, { queuePosition: index + 1 }),
      ),
    );
    await this.repo.update({ status: 'processing' }, { queuePosition: null });
  }
}
