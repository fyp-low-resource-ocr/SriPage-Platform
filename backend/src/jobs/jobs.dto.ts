import {
  IsInt,
  IsMimeType,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PresignUploadDto {
  @ApiProperty({ example: 'invoice.pdf', description: 'Original filename.' })
  @IsString()
  @IsNotEmpty()
  filename!: string;
  @ApiProperty({ example: 'application/pdf' })
  @IsMimeType()
  mimeType!: string;
  @ApiProperty({
    example: 245760,
    minimum: 1,
    description: 'File size in bytes.',
  })
  @IsInt()
  @Min(1)
  size!: number;
}
export class CreateJobDto {
  @ApiProperty({ example: 'invoice.pdf' })
  @IsString()
  @IsNotEmpty()
  filename!: string;
  @ApiProperty({ example: 'application/pdf' })
  @IsMimeType()
  mimeType!: string;
  @ApiProperty({
    example: 245760,
    minimum: 1,
    description: 'File size in bytes.',
  })
  @IsInt()
  @Min(1)
  size!: number;
  @ApiProperty({
    example: 'inputs/uuid-invoice.pdf',
    description: 'Object key returned by the presign endpoint.',
  })
  @IsString()
  @IsNotEmpty()
  inputObjectKey!: string;
  @ApiPropertyOptional({ default: 'non-vlm', enum: ['non-vlm', 'vlm'] })
  @IsOptional()
  @IsString()
  method = 'non-vlm';
}
