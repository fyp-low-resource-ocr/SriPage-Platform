import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParserModule } from '../parsers/parser.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { Job } from './job.entity';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { AnonymousSessionService } from './anonymous-session.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
    QueueModule,
    StorageModule,
    ParserModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, AnonymousSessionService],
  exports: [JobsService],
})
export class JobsModule {}
