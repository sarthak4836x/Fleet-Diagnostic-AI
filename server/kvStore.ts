/**
 * Tiny JSON key-value store with three backends:
 *
 *  1. Upstash Redis (REST)  — used automatically when UPSTASH_REDIS_REST_URL / _TOKEN
 *     (or Vercel KV's KV_REST_API_URL / _TOKEN) are set. This is what makes data
 *     persistent on Vercel, where the filesystem is read-only and every request may
 *     hit a different serverless instance.
 *  2. Local JSON files under ./data — used for `npm run dev` / `npm start` on a normal server.
 *  3. In-memory — fallback on Vercel when no Redis is configured (data resets on cold start).
 *
 * No extra npm dependency: Upstash is called with plain fetch.
 *
 * Set keys (addToSet / getSet) hold a set, not JSON: never call `get` on one (Redis answers WRONGTYPE).
 * Counter keys (increment) are only ever touched with increment and del, never get or set.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

export type StoreKind = "redis" | "file" | "memory";

export interface KvStore {
  kind: StoreKind;
  get<T>(key: string): Promise<T | null>;
  /**
   * With `ttlSeconds`, the value is gone (get answers null) that many seconds later. Keys written
   * with an expiry are only read with get and removed with del (setIfAbsent does not look at it).
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Writes only when the key is missing. True when this call wrote it. */
  setIfAbsent<T>(key: string, value: T): Promise<boolean>;
  addToSet(key: string, member: string): Promise<void>;
  /** The set's members, or [] when it does not exist. */
  getSet(key: string): Promise<string[]>;
  /** How many members the set has (0 when it does not exist), without listing them. */
  setSize(key: string): Promise<number>;
  /**
   * Adds one to a counter and returns the new count. A missing (or expired) counter starts at 1 and
   * expires `ttlSeconds` later; later calls never move the expiry. Parallel calls each count.
   */
  increment(key: string, ttlSeconds: number): Promise<number>;
  /** Puts a counter back to 0, expiring `ttlSeconds` from now; the next increment answers 1. */
  resetCounter(key: string, ttlSeconds: number): Promise<void>;
}

/** How long a Redis counter call may take before the caller gives up (the rate limiter then counts in memory). */
const INCREMENT_TIMEOUT_MS = 2000;

export const INCREMENT_SCRIPT =
  "local c=redis.call('INCR',KEYS[1]) if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end return c";

/** How the file store keeps a value written with an expiry. */
const EXPIRING = "$fleetdiag_expiring_v1";
interface Expiring {
  [EXPIRING]: true;
  expiresAt: number;
  value: unknown;
}
function isExpiring(v: unknown): v is Expiring {
  return !!v && typeof v === "object" && (v as Record<string, unknown>)[EXPIRING] === true;
}

const IS_VERCEL = Boolean(process.env.VERCEL);

// Vercel previews can receive the same Redis credentials as production. Previews run with demo
// settings, so their keys are kept apart: a preview can never read or change live accounts.
export function redisKeyPrefix(env: Record<string, string | undefined> = process.env): string {
  return env.VERCEL && env.VERCEL_ENV !== "production" ? `${env.VERCEL_ENV || "preview"}:` : "";
}

export function redisStore(url: string, token: string): KvStore {
  const base = url.replace(/\/+$/, "");
  const headers = { Authorization: `Bearer ${token}` };
  const prefix = redisKeyPrefix();
  /** Upstash can answer 200 with `{ error }` (e.g. WRONGTYPE); that must never be read as an empty result. */
  async function resultOf<R>(res: Response, name: string): Promise<R> {
    if (!res.ok) throw new Error(`Redis ${name} failed (${res.status})`);
    const body = (await res.json()) as { result?: R; error?: unknown };
    if (body && body.error != null) throw new Error(`Redis ${name} failed: ${String(body.error)}`);
    return body.result as R;
  }
  /** One command as a JSON array posted to the root URL (Upstash REST). */
  async function command<R>(name: string, args: string[], timeoutMs?: number): Promise<R> {
    const res = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify([name, ...args]),
      cache: "no-store",
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
    return resultOf<R>(res, name);
  }
  return {
    kind: "redis",
    async get<T>(key: string) {
      const res = await fetch(`${base}/get/${encodeURIComponent(prefix + key)}`, { headers, cache: "no-store" });
      const result = await resultOf<string | null>(res, "GET");
      return result == null ? null : (JSON.parse(result) as T);
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      if (ttlSeconds) {
        await command("SET", [prefix + key, JSON.stringify(value), "EX", String(ttlSeconds)]);
        return;
      }
      const res = await fetch(`${base}/set/${encodeURIComponent(prefix + key)}`, {
        method: "POST",
        headers,
        body: JSON.stringify(value),
      });
      await resultOf(res, "SET");
    },
    async del(key: string) {
      await command("DEL", [prefix + key]);
    },
    async setIfAbsent<T>(key: string, value: T) {
      return (await command<string | null>("SET", [prefix + key, JSON.stringify(value), "NX"])) === "OK";
    },
    async addToSet(key: string, member: string) {
      await command("SADD", [prefix + key, member]);
    },
    async getSet(key: string) {
      return (await command<string[] | null>("SMEMBERS", [prefix + key])) ?? [];
    },
    async setSize(key: string) {
      return (await command<number | null>("SCARD", [prefix + key])) ?? 0;
    },
    /**
     * One round trip, atomic on the server: ["EVAL", INCREMENT_SCRIPT, "1", key, ttl] posted to the root URL.
     * The script adds one, and gives the key an expiry whenever it has none (TTL < 0), so a new
     * counter gets one and a counter that somehow lost its expiry gets it back. Any Redis version.
     */
    async increment(key: string, ttlSeconds: number) {
      const count = await command<unknown>("EVAL", [INCREMENT_SCRIPT, "1", prefix + key, String(ttlSeconds)], INCREMENT_TIMEOUT_MS);
      if (typeof count !== "number" || !Number.isInteger(count)) throw new Error("Redis EVAL (increment) failed: no count");
      return count;
    },
    /** SET key "0" EX ttl: INCR then counts from 1, and keeps this expiry (the script sees TTL > 0). */
    async resetCounter(key: string, ttlSeconds: number) {
      await command("SET", [prefix + key, "0", "EX", String(ttlSeconds)]);
    },
  };
}

interface StoredCounter {
  count: number;
  expiresAt: number;
}

function isStoredCounter(v: unknown): v is StoredCounter {
  const c = v as StoredCounter;
  return !!c && typeof c === "object" && Number.isInteger(c.count) && typeof c.expiresAt === "number";
}

/** The next value of a counter, given what is stored now (null when missing). */
function nextCounter(stored: StoredCounter | null, ttlSeconds: number, now: number): StoredCounter {
  if (stored && stored.expiresAt > now) return { count: stored.count + 1, expiresAt: stored.expiresAt };
  return { count: 1, expiresAt: now + ttlSeconds * 1000 };
}

export function fileStore(dir: string): KvStore {
  const root = path.resolve(dir);
  const fileFor = (key: string) => {
    // Keys are reduced to [a-zA-Z0-9_-], and the result must still resolve inside the data folder.
    const target = path.resolve(root, `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    if (!target.startsWith(root + path.sep)) throw new Error("Invalid storage key.");
    return target;
  };
  // Only a missing file means "no value". A corrupt or unreadable file throws, so callers never
  // mistake it for empty data and overwrite it.
  const read = <T>(key: string): T | null => {
    let text: string;
    try {
      text = fs.readFileSync(fileFor(key), "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    return JSON.parse(text) as T;
  };
  // Synchronous on purpose: with no await between a read and this write, one process never interleaves them.
  const write = (key: string, value: unknown) => {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const target = fileFor(key);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { encoding: "utf-8", mode: 0o600 });
    fs.renameSync(tmp, target);
  };
  return {
    kind: "file",
    async get<T>(key: string) {
      const stored = read<unknown>(key);
      if (!isExpiring(stored)) return stored as T | null;
      return stored.expiresAt > Date.now() ? (stored.value as T) : null;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      if (!ttlSeconds) return write(key, value);
      const wrapped: Expiring = { [EXPIRING]: true, expiresAt: Date.now() + ttlSeconds * 1000, value };
      write(key, wrapped);
    },
    async del(key: string) {
      try {
        fs.unlinkSync(fileFor(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    },
    async setIfAbsent<T>(key: string, value: T) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const target = fileFor(key);
      const json = JSON.stringify(value, null, 2);
      // Write the whole value to a private temporary file, then publish it with a hard link: the
      // link either appears complete or fails with EEXIST, so a crash never leaves half a claim.
      const tmp = `${target}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
      fs.writeFileSync(tmp, json, { encoding: "utf-8", flag: "wx", mode: 0o600 });
      try {
        fs.linkSync(tmp, target);
        return true;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "EEXIST") return false;
        if (!LINK_UNSUPPORTED.has(code ?? "")) throw err;
        // No hard links on this filesystem: an exclusive create still gives one winner, but is not crash-safe.
        try {
          fs.writeFileSync(target, json, { encoding: "utf-8", flag: "wx", mode: 0o600 });
          return true;
        } catch (fallbackErr) {
          if ((fallbackErr as NodeJS.ErrnoException).code === "EEXIST") return false;
          throw fallbackErr;
        }
      } finally {
        fs.rmSync(tmp, { force: true });
      }
    },
    async addToSet(key: string, member: string) {
      const members = read<string[]>(key) ?? [];
      if (!members.includes(member)) write(key, [...members, member]);
    },
    async getSet(key: string) {
      return read<string[]>(key) ?? [];
    },
    async setSize(key: string) {
      return (read<string[]>(key) ?? []).length;
    },
    // Read and write with no await in between, so calls in one process never lose a count.
    async increment(key: string, ttlSeconds: number) {
      const stored = read<unknown>(key);
      if (stored !== null && !isStoredCounter(stored)) throw new Error(`[store] ${key} does not hold a counter`);
      const next = nextCounter(stored as StoredCounter | null, ttlSeconds, Date.now());
      write(key, next);
      return next.count;
    },
    async resetCounter(key: string, ttlSeconds: number) {
      write(key, { count: 0, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
  };
}

/** Errors from fs.linkSync that mean the filesystem cannot make hard links at all. */
const LINK_UNSUPPORTED = new Set(["EPERM", "ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EXDEV", "EINVAL"]);

export function memoryStore(): KvStore {
  const mem = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const counters = new Map<string, StoredCounter>();
  const expiries = new Map<string, number>();
  return {
    kind: "memory",
    async get<T>(key: string) {
      const expiresAt = expiries.get(key);
      if (expiresAt !== undefined && expiresAt <= Date.now()) {
        mem.delete(key);
        expiries.delete(key);
      }
      const v = mem.get(key);
      return v == null ? null : (JSON.parse(v) as T);
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      mem.set(key, JSON.stringify(value));
      if (ttlSeconds) expiries.set(key, Date.now() + ttlSeconds * 1000);
      else expiries.delete(key);
    },
    async del(key: string) {
      expiries.delete(key);
      mem.delete(key);
      sets.delete(key);
      counters.delete(key);
    },
    async setIfAbsent<T>(key: string, value: T) {
      if (mem.has(key)) return false;
      mem.set(key, JSON.stringify(value));
      return true;
    },
    async addToSet(key: string, member: string) {
      const s = sets.get(key) ?? new Set<string>();
      s.add(member);
      sets.set(key, s);
    },
    async getSet(key: string) {
      return [...(sets.get(key) ?? [])];
    },
    async setSize(key: string) {
      return sets.get(key)?.size ?? 0;
    },
    async increment(key: string, ttlSeconds: number) {
      const next = nextCounter(counters.get(key) ?? null, ttlSeconds, Date.now());
      counters.set(key, next);
      return next.count;
    },
    async resetCounter(key: string, ttlSeconds: number) {
      counters.set(key, { count: 0, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
  };
}

function createStore(): KvStore {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return redisStore(url, token);
  if (IS_VERCEL) {
    console.warn(
      "[store] No Upstash Redis configured on Vercel — accounts, password changes and resets are kept in memory " +
        "and reset on cold start. Add the Upstash Redis integration in Vercel to make them persistent."
    );
    return memoryStore();
  }
  return fileStore(path.join(process.env.FLEETDIAG_DATA_DIR || path.join(process.cwd(), "data"), "auth"));
}

export const kv: KvStore = createStore();
