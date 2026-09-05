import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { ParserService } from '../parsers/parser.service';
import { PARSE_QUEUE_TOKEN } from '../queue/queue.module';
import { StorageService } from '../storage/storage.service';
import { CreateJobDto, PresignUploadDto } from './jobs.dto';
import { Job } from './job.entity';
import { AnonymousSessionService } from './anonymous-session.service';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private readonly repo: Repository<Job>,
    @Inject(PARSE_QUEUE_TOKEN) private readonly queue: Queue,
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
    await this.queue.add(
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
