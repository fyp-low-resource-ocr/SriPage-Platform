import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ParserService } from '../parsers/parser.service';
import { CreateJobDto, PresignUploadDto } from './jobs.dto';
import { Job } from './job.entity';
import { JobsService } from './jobs.service';
@Controller()
@ApiTags('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly parsers: ParserService,
  ) {}
  @Get('methods')
  @ApiOperation({ summary: 'List available parsing methods' })
  methods() {
    return this.parsers.list();
  }

  @Post('uploads/presign')
  @ApiOperation({ summary: 'Create a presigned upload URL' })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        objectKey: 'inputs/uuid-invoice.pdf',
        uploadUrl: 'http://localhost:9000/...',
      },
    },
  })
  presign(@Body() dto: PresignUploadDto) {
    return this.jobs.presign(dto);
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Create and queue a PDF parsing job' })
  @ApiResponse({ status: 201, type: Job })
  create(@Body() dto: CreateJobDto) {
    return this.jobs.create(dto);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List parsing jobs, newest first' })
  @ApiResponse({ status: 200, type: Job, isArray: true })
  list() {
    return this.jobs.list();
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get a parsing job by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: Job })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  get(@Param('id') id: string) {
    return this.jobs.get(id);
  }

  @Get('jobs/:id/result')
  @ApiOperation({ summary: 'Get a presigned URL for a completed result' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    schema: { example: { url: 'http://localhost:9000/...' } },
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found or result is not ready.',
  })
  result(@Param('id') id: string) {
    return this.jobs.getResultUrl(id);
  }
}
