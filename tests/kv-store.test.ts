import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fileStore, memoryStore, redisStore, type KvStore } from '../server/kvStore';

const backends: Array<[string, () => KvStore]> = [
  ['file', () => fileStore(fs.mkdtempSync(path.join(os.tmpdir(), 'kv-test-')))],
  ['memory', () => memoryStore()],
];

describe.each(backends)('%s store', (_name, make) => {
  it('setIfAbsent writes once', async () => {
    const s = make();
    expect(await s.setIfAbsent('k:a.b@x.com', { v: 1 })).toBe(true);
    expect(await s.setIfAbsent('k:a.b@x.com', { v: 2 })).toBe(false);
    expect(await s.get('k:a.b@x.com')).toEqual({ v: 1 });
  });

  it('del removes a key and tolerates a missing one', async () => {
    const s = make();
    await s.set('gone', 'x');
    await s.del('gone');
    expect(await s.get('gone')).toBeNull();
    await expect(s.del('never-there')).resolves.toBeUndefined();
    expect(await s.setIfAbsent('gone', 'again')).toBe(true);
  });

  it('sets hold each member once', async () => {
    const s = make();
    expect(await s.getSet('members')).toEqual([]);
    await s.addToSet('members', 'a');
    await s.addToSet('members', 'b');
    await s.addToSet('members', 'a');
    expect((await s.getSet('members')).sort()).toEqual(['a', 'b']);
  });

  it('setSize counts members without listing them', async () => {
    const s = make();
    expect(await s.setSize('sized')).toBe(0);
    await s.addToSet('sized', 'a');
    await s.addToSet('sized', 'b');
    await s.addToSet('sized', 'a');
    expect(await s.setSize('sized')).toBe(2);
  });

  it('set with an expiry is gone once it passes; set without one stays', async () => {
    const s = make();
    const now = vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    try {
      await s.set('exp:a', { v: 1 }, 10);
      await s.set('exp:b', { v: 2 });
      now.mockReturnValue(2_000_000 + 9_000);
      expect(await s.get('exp:a')).toEqual({ v: 1 });
      now.mockReturnValue(2_000_000 + 10_001);
      expect(await s.get('exp:a')).toBeNull();
      expect(await s.get('exp:b')).toEqual({ v: 2 });
      await s.set('exp:a', 5); // a later plain set has no expiry
      now.mockReturnValue(2_000_000 + 999_999);
      expect(await s.get('exp:a')).toBe(5);
    } finally {
      now.mockRestore();
    }
  });

  it('increment counts up from one and keeps keys apart', async () => {
    const s = make();
    expect(await s.increment('ctr:a', 60)).toBe(1);
    expect(await s.increment('ctr:a', 60)).toBe(2);
    expect(await s.increment('ctr:b', 60)).toBe(1);
    expect(await s.increment('ctr:a', 60)).toBe(3);
  });

  it('resetCounter puts a counter back to zero with a new expiry', async () => {
    const s = make();
    const now = vi.spyOn(Date, 'now').mockReturnValue(3_000_000);
    try {
      for (let i = 0; i < 5; i++) await s.increment('ctr:reset', 86_400);
      await s.resetCounter('ctr:reset', 60);
      expect(await s.increment('ctr:reset', 86_400)).toBe(1);
      now.mockReturnValue(3_000_000 + 60_001); // the short expiry, not the long one, applies
      expect(await s.increment('ctr:reset', 86_400)).toBe(1);
    } finally {
      now.mockRestore();
    }
  });

  it('increment counts every one of many parallel calls', async () => {
    const s = make();
    const results = await Promise.all(Array.from({ length: 20 }, () => s.increment('ctr:par', 60)));
    expect(results.sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('increment starts again once the expiry has passed, and del resets it', async () => {
    const s = make();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      expect(await s.increment('ctr:ttl', 10)).toBe(1);
      now.mockReturnValue(1_000_000 + 5_000);
      expect(await s.increment('ctr:ttl', 10)).toBe(2); // the expiry is set by the first call only
      now.mockReturnValue(1_000_000 + 10_001);
      expect(await s.increment('ctr:ttl', 10)).toBe(1);
      await s.del('ctr:ttl');
      expect(await s.increment('ctr:ttl', 10)).toBe(1);
    } finally {
      now.mockRestore();
    }
  });
});

describe('file store failures', () => {
  afterEach(() => vi.restoreAllMocks());
  const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kv-fail-'));

  it('returns null only for a missing file and throws on a corrupt one', async () => {
    const d = dir();
    const s = fileStore(d);
    expect(await s.get('missing')).toBeNull();
    fs.writeFileSync(path.join(d, 'broken.json'), '{ not json');
    await expect(s.get('broken')).rejects.toThrow();
    await expect(s.getSet('broken')).rejects.toThrow();
    await expect(s.addToSet('broken', 'x')).rejects.toThrow();
    expect(fs.readFileSync(path.join(d, 'broken.json'), 'utf-8')).toBe('{ not json'); // never overwritten
  });

  it('increment throws on a corrupt counter file instead of starting again at one', async () => {
    const d = dir();
    const s = fileStore(d);
    fs.writeFileSync(path.join(d, 'ctr.json'), '{ not json');
    await expect(s.increment('ctr', 60)).rejects.toThrow();
    fs.writeFileSync(path.join(d, 'ctr.json'), JSON.stringify({ something: 'else' }));
    await expect(s.increment('ctr', 60)).rejects.toThrow();
  });

  it('setIfAbsent publishes a complete file and leaves no temporary file behind', async () => {
    const d = dir();
    const s = fileStore(d);
    // A crash cannot leave a half-written claim: the content is written to a temporary file first,
    // then published with a hard link, which either appears complete or fails with EEXIST.
    const link = vi.spyOn(fs, 'linkSync');
    expect(await s.setIfAbsent('claim', { v: 1 })).toBe(true);
    expect(await s.setIfAbsent('claim', { v: 2 })).toBe(false);
    expect(link).toHaveBeenCalledTimes(2);
    expect(await s.get('claim')).toEqual({ v: 1 });
    expect(fs.readdirSync(d)).toEqual(['claim.json']);
  });

  it('setIfAbsent falls back to an exclusive write where hard links are not supported', async () => {
    const d = dir();
    const s = fileStore(d);
    vi.spyOn(fs, 'linkSync').mockImplementation(() => {
      throw Object.assign(new Error('no links here'), { code: 'EPERM' });
    });
    expect(await s.setIfAbsent('claim', { v: 1 })).toBe(true);
    expect(await s.setIfAbsent('claim', { v: 2 })).toBe(false);
    expect(await s.get('claim')).toEqual({ v: 1 });
    expect(fs.readdirSync(d)).toEqual(['claim.json']);
  });
});

describe('redis store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('redis sends the documented commands', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    const replies: unknown[] = [{ result: 1 }, { result: 'OK' }, { result: null }, { result: 1 }, { result: ['a', 'b'] }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: any) => {
        calls.push({ url, init });
        return { ok: true, status: 200, json: async () => replies.shift() } as any;
      })
    );
    // Vitest runs with VERCEL=1 and no VERCEL_ENV, so keys carry the preview prefix.
    const s = redisStore('https://redis.example.com/', 'tok');
    await s.del('k1');
    expect(await s.setIfAbsent('k2', { v: 1 })).toBe(true);
    expect(await s.setIfAbsent('k2', { v: 2 })).toBe(false);
    await s.addToSet('set1', 'm1');
    expect(await s.getSet('set1')).toEqual(['a', 'b']);

    for (const c of calls) {
      expect(c.url).toBe('https://redis.example.com');
      expect(c.init.method).toBe('POST');
      expect(c.init.headers.Authorization).toBe('Bearer tok');
    }
    expect(calls.map((c) => JSON.parse(c.init.body))).toEqual([
      ['DEL', 'preview:k1'],
      ['SET', 'preview:k2', JSON.stringify({ v: 1 }), 'NX'],
      ['SET', 'preview:k2', JSON.stringify({ v: 2 }), 'NX'],
      ['SADD', 'preview:set1', 'm1'],
      ['SMEMBERS', 'preview:set1'],
    ]);
  });

  it('redis counts a set with SCARD', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        bodies.push(JSON.parse(init.body));
        return { ok: true, status: 200, json: async () => ({ result: 3 }) } as any;
      })
    );
    expect(await redisStore('https://redis.example.com', 'tok').setSize('s')).toBe(3);
    expect(bodies).toEqual([['SCARD', 'preview:s']]);
  });

  it('redis throws on an error reply that comes with status 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ error: 'WRONGTYPE Operation against a key' }) }) as any)
    );
    const s = redisStore('https://redis.example.com', 'tok');
    await expect(s.setIfAbsent('k', 1)).rejects.toThrow(/WRONGTYPE/);
    await expect(s.getSet('k')).rejects.toThrow(/WRONGTYPE/);
    await expect(s.setSize('k')).rejects.toThrow(/WRONGTYPE/);
    await expect(s.del('k')).rejects.toThrow();
    await expect(s.addToSet('k', 'm')).rejects.toThrow();
    await expect(s.get('k')).rejects.toThrow(/WRONGTYPE/);
  });

  it('increment is one atomic EVAL that sets a missing expiry', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: any) => {
        calls.push({ url, init });
        return { ok: true, status: 200, json: async () => ({ result: 4 }) } as any;
      })
    );
    expect(await redisStore('https://redis.example.com/', 'tok').increment('rl:x', 60)).toBe(4);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://redis.example.com');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(calls[0].init.body)).toEqual([
      'EVAL',
      "local c=redis.call('INCR',KEYS[1]) if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end return c",
      '1',
      'preview:rl:x',
      '60',
    ]);
  });

  it('increment throws on an error reply or a reply that is not a count', async () => {
    const reply = (body: unknown, ok = true) =>
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }) as any));
    const s = redisStore('https://redis.example.com', 'tok');
    reply({ error: 'WRONGTYPE Operation against a key' });
    await expect(s.increment('k', 60)).rejects.toThrow(/WRONGTYPE/);
    reply({ result: 'not a number' });
    await expect(s.increment('k', 60)).rejects.toThrow();
    reply({}, false);
    await expect(s.increment('k', 60)).rejects.toThrow();
  });

  it('resetCounter is one SET key 0 EX command', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        bodies.push(JSON.parse(init.body));
        return { ok: true, status: 200, json: async () => ({ result: 'OK' }) } as any;
      })
    );
    await redisStore('https://redis.example.com', 'tok').resetCounter('ctr', 60);
    expect(bodies).toEqual([['SET', 'preview:ctr', '0', 'EX', '60']]);
  });

  it('set with an expiry is one SET ... EX command', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: any) => {
        expect(url).toBe('https://redis.example.com');
        bodies.push(JSON.parse(init.body));
        return { ok: true, status: 200, json: async () => ({ result: 'OK' }) } as any;
      })
    );
    await redisStore('https://redis.example.com', 'tok').set('lock', 123, 360);
    expect(bodies).toEqual([['SET', 'preview:lock', '123', 'EX', '360']]);
  });

  it('throws on a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as any));
    const s = redisStore('https://redis.example.com', 'tok');
    await expect(s.del('k')).rejects.toThrow();
    await expect(s.setIfAbsent('k', 1)).rejects.toThrow();
    await expect(s.addToSet('k', 'm')).rejects.toThrow();
    await expect(s.getSet('k')).rejects.toThrow();
  });
});
