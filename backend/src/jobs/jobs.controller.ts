import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ParserService } from '../parsers/parser.service';
import { CreateJobDto, PresignUploadDto } from './jobs.dto';
import { Job } from './job.entity';
import { JobsService } from './jobs.service';
import { AnonymousSessionService } from './anonymous-session.service';
@Controller()
@ApiTags('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly parsers: ParserService,
    private readonly sessions: AnonymousSessionService,
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
  presign(
    @Body() dto: PresignUploadDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.jobs.presign(dto, this.sessions.getOwnerHash(req, res));
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Create and queue a PDF parsing job' })
  @ApiResponse({ status: 201, type: Job })
  create(
    @Body() dto: CreateJobDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.jobs.create(dto, this.sessions.getOwnerHash(req, res));
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List parsing jobs, newest first' })
  @ApiResponse({ status: 200, type: Job, isArray: true })
  list(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.jobs.list(this.sessions.getOwnerHash(req, res));
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get a parsing job by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: Job })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  get(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.jobs.get(id, this.sessions.getOwnerHash(req, res));
  }

  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Cancel a queued parsing job' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: Job })
  @ApiResponse({
    status: 409,
    description: 'Job is already processing or finished.',
  })
  cancel(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.jobs.cancel(id, this.sessions.getOwnerHash(req, res));
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
  result(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.jobs.getResultUrl(id, this.sessions.getOwnerHash(req, res));
  }
}
