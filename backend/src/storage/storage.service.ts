import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: Client;
  private readonly presignClient: Client;
  private readonly bucket: string;
  constructor(private readonly config: ConfigService) {
    this.client = new Client({
      endPoint: config.get('MINIO_ENDPOINT', 'localhost'),
      port: Number(config.get('MINIO_PORT', 9000)),
      useSSL: config.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: config.getOrThrow('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow('MINIO_SECRET_KEY'),
    });
    this.presignClient = new Client({
      endPoint: config.get(
        'MINIO_PUBLIC_ENDPOINT',
        config.get('MINIO_ENDPOINT', 'localhost'),
      ),
      port: Number(
        config.get('MINIO_PUBLIC_PORT', config.get('MINIO_PORT', 9000)),
      ),
      useSSL:
        config.get(
          'MINIO_PUBLIC_USE_SSL',
          config.get('MINIO_USE_SSL', 'false'),
        ) === 'true',
      accessKey: config.getOrThrow('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow('MINIO_SECRET_KEY'),
    });
    this.bucket = config.get('MINIO_BUCKET', 'sripage');
  }
  async onModuleInit() {
    if (!(await this.client.bucketExists(this.bucket)))
      await this.client.makeBucket(this.bucket, 'us-east-1');
  }
  presignUpload(objectKey: string) {
    return this.presignClient.presignedPutObject(this.bucket, objectKey, 900);
  }
  async putJson(objectKey: string, value: unknown) {
    const body = Buffer.from(JSON.stringify(value, null, 2));
    await this.client.putObject(this.bucket, objectKey, body, body.length, {
      'Content-Type': 'application/json',
    });
  }
  presignDownload(objectKey: string) {
    return this.presignClient.presignedGetObject(this.bucket, objectKey, 900);
  }
}
