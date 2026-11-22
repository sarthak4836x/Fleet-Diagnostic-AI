import { describe, it, expect, vi, beforeAll } from 'vitest';

// Counting works, but deleting an attempt counter fails. The count must not stay at the maximum,
// or every try after the lock expires (the right password included) would lock the account again.
const shared = vi.hoisted(() => ({ inner: null as any }));
vi.mock('../server/kvStore', async () => {
  const actual = await vi.importActual<typeof import('../server/kvStore')>('../server/kvStore');
  const inner = actual.memoryStore();
  shared.inner = inner;
  const kv = {
    ...inner,
    kind: 'redis' as const,
    del: async (key: string) => {
      if (key.includes('_fails_v3:')) throw new Error('Redis DEL failed (503)');
      return inner.del(key);
    },
  };
  return { ...actual, kv };
});

import request from 'supertest';
import app from '../server';
import { isEmailTaken } from '../server/auth';

let ipCounter = 0;
const nextIp = () => `10.13.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const login = (identifier: string, password: string) =>
  request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier, password });

beforeAll(async () => {
  await isEmailTaken('nobody@example.com');
});

describe('when deleting an attempt counter fails', () => {
  it('the count does not stay at the maximum after the lock ends', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 5; i++) expect((await login('director', `Wrong-${i}-z`)).status).toBe(401);
    expect((await login('director', 'Test-director-1')).status).toBe(429);

    // The lock runs out (its key is gone); the counter's delete failed when the lock was written.
    const crypto = await import('crypto');
    const id = (await shared.inner.get(
      `fleetdiag_user_login_v3:${crypto.createHash('sha256').update('director').digest('hex')}`
    )) as string;
    expect(id).toBeTruthy();
    await shared.inner.del(`fleetdiag_user_login_lock_v3:${id}`);

    expect((await login('director', 'Test-director-1')).status).toBe(200);
  });
});
