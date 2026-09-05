import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
export type JobStatus =
  'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
@Entity('jobs')
export class Job {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @ApiProperty({ nullable: true, writeOnly: true })
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  ownerTokenHash!: string | null;
  @ApiProperty({ example: 'invoice.pdf' })
  @Column()
  filename!: string;
  @ApiProperty({ example: 'application/pdf' })
  @Column()
  mimeType!: string;
  @ApiProperty({ example: 245760 })
  @Column('bigint')
  size!: number;
  @ApiProperty({ example: 'inputs/uuid-invoice.pdf' })
  @Column()
  inputObjectKey!: string;
  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  resultObjectKey!: string | null;
  @ApiProperty({ example: 'non-vlm' })
  @Column()
  method!: string;
  @ApiProperty({ enum: ['cpu', 'gpu'], example: 'cpu' })
  @Column({ default: 'cpu' })
  runtime!: 'cpu' | 'gpu';
  @ApiProperty({
    enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
    example: 'queued',
  })
  @Column({ default: 'queued' })
  status!: JobStatus;
  @ApiProperty({ nullable: true, example: 1 })
  @Column({ type: 'int', nullable: true })
  queuePosition!: number | null;
  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  @Column({ type: 'jsonb', nullable: true })
  result!: unknown;
  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  error!: string | null;
  @ApiProperty({ format: 'date-time' })
  @CreateDateColumn()
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  @UpdateDateColumn()
  updatedAt!: Date;
}
