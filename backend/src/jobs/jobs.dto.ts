import { IsInt, IsMimeType, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
export class PresignUploadDto {
  @IsString() @IsNotEmpty() filename!: string;
  @IsMimeType() mimeType!: string;
  @IsInt() @Min(1) size!: number;
}
export class CreateJobDto {
  @IsString() @IsNotEmpty() filename!: string;
  @IsMimeType() mimeType!: string;
  @IsInt() @Min(1) size!: number;
  @IsString() @IsNotEmpty() inputObjectKey!: string;
  @IsOptional() @IsString() method = 'vlm';
}
