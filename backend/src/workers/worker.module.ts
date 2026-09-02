import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsModule } from '../jobs/jobs.module';
import { Job } from '../jobs/job.entity';
import { ParserModule } from '../parsers/parser.module';
import { StorageModule } from '../storage/storage.module';
import { WorkerService } from './worker.service';
@Module({ imports: [TypeOrmModule.forFeature([Job]), JobsModule, ParserModule, StorageModule], providers: [WorkerService] })
export class WorkerModule {}
