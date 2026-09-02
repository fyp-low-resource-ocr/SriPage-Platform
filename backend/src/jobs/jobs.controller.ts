import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ParserService } from '../parsers/parser.service';
import { CreateJobDto, PresignUploadDto } from './jobs.dto';
import { JobsService } from './jobs.service';
@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService, private readonly parsers: ParserService) {}
  @Get('methods') methods() { return this.parsers.list(); }
  @Post('uploads/presign') presign(@Body() dto: PresignUploadDto) { return this.jobs.presign(dto); }
  @Post('jobs') create(@Body() dto: CreateJobDto) { return this.jobs.create(dto); }
  @Get('jobs') list() { return this.jobs.list(); }
  @Get('jobs/:id') get(@Param('id') id: string) { return this.jobs.get(id); }
  @Get('jobs/:id/result') result(@Param('id') id: string) { return this.jobs.getResultUrl(id); }
}
