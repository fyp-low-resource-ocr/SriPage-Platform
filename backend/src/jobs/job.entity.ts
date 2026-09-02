import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() filename!: string;
  @Column() mimeType!: string;
  @Column('bigint') size!: number;
  @Column() inputObjectKey!: string;
  @Column({ nullable: true }) resultObjectKey!: string | null;
  @Column() method!: string;
  @Column({ default: 'cpu' }) runtime!: 'cpu' | 'gpu';
  @Column({ default: 'queued' }) status!: JobStatus;
  @Column({ type: 'int', nullable: true }) queuePosition!: number | null;
  @Column({ type: 'jsonb', nullable: true }) result!: unknown;
  @Column({ type: 'text', nullable: true }) error!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
