/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { BadRequestException, NotFoundException } from '@nestjs/common';
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('./job.entity', () => ({}));
jest.mock('../parsers/parser.service', () => ({}));
jest.mock('../storage/storage.service', () => ({}));
jest.mock('../queue/queue.module', () => ({
  PARSE_QUEUE_TOKEN: 'PARSE_QUEUE',
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
import { JobsService } from './jobs.service';

describe('JobsService anonymous ownership', () => {
  const owner = 'a'.repeat(64);
  const otherOwner = 'b'.repeat(64);
  let repo: any;
  let queue: any;
  let storage: any;
  let parsers: any;
  let sessions: any;
  let service: JobsService;

  beforeEach(() => {
    repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (job) => ({ ...job, id: 'job-1' })),
      find: jest.fn(async () => []),
      findOneBy: jest.fn(async () => ({ id: 'job-1' })),
      update: jest.fn(),
    };
    queue = { add: jest.fn() };
    storage = {
      presignUpload: jest.fn(async (key) => `upload:${key}`),
      presignDownload: jest.fn(async (key) => `download:${key}`),
    };
    parsers = { get: jest.fn(() => ({ supportedRuntimes: ['cpu'] })) };
    sessions = { objectKeyBelongsToOwner: jest.fn(() => true) };
    service = new JobsService(repo, queue, storage, parsers, sessions);
  });

  it('lists only jobs belonging to the current browser', async () => {
    await service.list(owner);
    expect(repo.find).toHaveBeenCalledWith({
      where: { ownerTokenHash: owner },
      order: { createdAt: 'DESC' },
    });
  });

  it('rejects an upload key belonging to another browser', async () => {
    sessions.objectKeyBelongsToOwner.mockReturnValue(false);
    await expect(
      service.create(
        {
          filename: 'invoice.pdf',
          mimeType: 'application/pdf',
          size: 10,
          inputObjectKey: `inputs/${otherOwner}/file.pdf`,
          method: 'non-vlm',
        },
        owner,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('stores the current owner on a new job', async () => {
    await service.create(
      {
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        size: 10,
        inputObjectKey: `inputs/${owner}/file.pdf`,
        method: 'non-vlm',
      },
      owner,
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerTokenHash: owner }),
    );
  });

  it('does not return a job owned by another browser', async () => {
    repo.findOneBy.mockResolvedValue(undefined);
    await expect(service.get('job-1', otherOwner)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findOneBy).toHaveBeenCalledWith({
      id: 'job-1',
      ownerTokenHash: otherOwner,
    });
  });
});
