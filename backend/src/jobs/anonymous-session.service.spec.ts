/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AnonymousSessionService } from './anonymous-session.service';

describe('AnonymousSessionService', () => {
  const config = {
    get: jest.fn(() => 'development'),
  } as unknown as ConfigService;
  const service = new AnonymousSessionService(config);

  it('issues a persistent HttpOnly cookie and returns its hash', () => {
    const response = { append: jest.fn() } as any;
    const hash = service.getOwnerHash({ headers: {} } as any, response);
    const cookie = response.append.mock.calls[0][1] as string;
    const token = cookie.split(';')[0].split('=')[1];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('reuses and hashes a valid existing cookie', () => {
    const token = 'c'.repeat(64);
    const response = { append: jest.fn() } as any;
    const hash = service.getOwnerHash(
      { headers: { cookie: `sripage_device=${token}` } } as any,
      response,
    );
    expect(response.append).not.toHaveBeenCalled();
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
  });
});
