import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';

export const ANONYMOUS_SESSION_COOKIE = 'sripage_device';
const TOKEN_BYTES = 32;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

@Injectable()
export class AnonymousSessionService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  getOwnerHash(request: Request, response: Response): string {
    const token =
      this.readCookie(request, ANONYMOUS_SESSION_COOKIE) ??
      this.issueToken(response);
    return createHash('sha256').update(token).digest('hex');
  }

  objectKeyBelongsToOwner(objectKey: string, ownerHash: string): boolean {
    return objectKey.startsWith(`inputs/${ownerHash}/`);
  }

  private issueToken(response: Response): string {
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const secure =
      this.config.get('NODE_ENV') === 'production' ? '; Secure' : '';
    response.append(
      'Set-Cookie',
      `${ANONYMOUS_SESSION_COOKIE}=${token}; Max-Age=${MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    );
    return token;
  }

  private readCookie(request: Request, name: string): string | undefined {
    const header = request.headers.cookie;
    if (!header) return undefined;
    const value = header
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([key]) => key === name)?.[1];
    return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
  }
}
