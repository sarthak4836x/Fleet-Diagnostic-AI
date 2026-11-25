/**
 * FleetDiag AI — server-side authentication
 *
 * - Passwords and security answers are stored only on the server as salted scrypt hashes.
 * - Sessions are HMAC-signed tokens delivered in an HttpOnly, SameSite=Strict cookie
 *   (never readable by page JavaScript, so an XSS bug cannot steal them).
 * - Changing a password bumps a per-user version number, which invalidates old sessions
 *   and any outstanding reset tokens.
 * - Login, OTP and security-question checks have per-account lockouts on top of the IP rate limiter.
 * - All state (users, OTPs, lockouts) lives in the KV store, and reset tokens are signed rather
 *   than kept in memory, so this works on serverless platforms such as Vercel where each
 *   request may run on a different instance.
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import crypto from "crypto";
import { ROLE_CREDENTIALS } from "../src/data/authCredentials";
import type { AuthUser, Fleet, UserRole } from "../src/types";
import { kv } from "./kvStore";
import { DEMO_FLEET_ID, getFleet } from "./fleetStore";
import { fleetRefusal, resolveFleetId, sendFleetRefusal } from "./fleetAccess";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface StoredQuestion {
  question: string;
  answerHash: string;
}

interface StoredUser {
  id: string;
  email: string;
  aliases: string[];
  name: string;
  role: UserRole;
  roleLabel: string;
  badgeNumber: string;
  avatarColor: string;
  shift?: string;
  depot?: string;
  fleetId?: string;
  activeFleetId?: string;
  permissions: string[];
  passwordHash: string;
  passwordVersion: number;
  securityQuestions: StoredQuestion[];
  createdAt: string;
}

/**
 * The password-reset code in flight. Kept apart from StoredUser: anyone can trigger these writes
 * without a session, and they must never be able to revert a password change on the same account.
 * Attempt counters and lock times have keys of their own (see below), so parallel wrong guesses
 * each count and one flow's write never undoes another's lock. Records written before that may still
 * hold failedLogins, lockedUntil and the like; those fields are ignored.
 */
interface UserThrottle {
  otpHash?: string; // HMAC of the code, never the code itself
  otpExpiresAt?: number;
}

/** Fields that older records kept on the account itself; stripped when accounts are migrated. */
const THROTTLE_FIELDS = [
  "failedLogins",
  "lockedUntil",
  "otpHash",
  "otpExpiresAt",
  "otpAttempts",
  "questionAttempts",
  "questionLockedUntil",
] as const;

export type AuthedRequest = Request & { user?: AuthUser; fleet?: Fleet; fleetVehicle?: any };

export type SecurityLogger = (
  type: any,
  severity: "INFO" | "WARNING" | "CRITICAL",
  req: Request,
  details: string,
  actionTaken?: string
) => void;

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------
const IS_PROD = process.env.NODE_ENV === "production";
const SESSION_COOKIE = "fd_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours
// Known-device cookies: proof that this browser signed in to an account before, one cookie per
// account (see deviceCookieName). Sent only to the sign-in route, they outlive sign-out and grant
// nothing but a lockout of their own (see the login route).
const DEVICE_COOKIE_PREFIX = "fd_device_";
const DEVICE_COOKIE_NAME_PATTERN = /^fd_device_[0-9a-f]{16}$/;
const DEVICE_COOKIE_PATH = "/api/auth/login";
// At most this many per browser (the one being set included); a sign-in removes the oldest and
// invalid extras. Each is about 300 bytes and is only sent to the sign-in route, so 10 is about 3 KB
// on that one request, well under any header limit, and still covers a depot PC shared by 10 people.
const MAX_DEVICE_COOKIES = 10;
// A request with far more (made up by hand) has them removed over several sign-ins, never all at
// once, so one response never carries a long list of Set-Cookie headers. Only this many are examined.
const MAX_DEVICE_COOKIE_REMOVALS = 20;
const MAX_DEVICE_COOKIES_EXAMINED = 64;
const DEVICE_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days, renewed on each sign-in from the device
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/; // 16 random bytes, base64url
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_SECONDS = 10 * 60;
const MAX_OTP_ATTEMPTS = 5;
const MAX_QUESTION_ATTEMPTS = 5;
// Wrong guesses are forgotten 4 minutes after the first one, a minute sooner than the lock lasts.
// A count that reached the maximum began before the lock it caused, so it has always expired by the
// time that lock ends, even when every call to clear it failed: a stuck count can never lock the
// account again after the lock (the spare minute absorbs clock drift between servers and the store).
// Someone guessing slower than 5 per 4 minutes gets fewer tries than the lockout already allows
// (5 per 5 minutes), so this never weakens it.
const FAILED_COUNT_TTL_SECONDS = LOCKOUT_MS / 1000 - 60;
// Lock keys outlive their lock by a minute, then the store drops them (see writeLock).
const LOCK_KEY_EXTRA_SECONDS = 60;
// The day cap: a second count of confirmed wrong passwords (or answer sets), kept for a day and
// cleared only by a success. Someone pacing under the short counter (4 per 4 minutes) gets 20 a
// day before a one-hour lock, and every further wrong one locks for another hour. It is only looked
// at after a wrong password, so it can never refuse a right one by itself.
const DAILY_MAX_FAILURES = 20;
const DAILY_COUNT_TTL_SECONDS = 24 * 60 * 60;
const LONG_LOCKOUT_MS = 60 * 60 * 1000;
const SECRET_KEY = "fleetdiag_session_secret_v1";

// One record per account (v3), so a write for one account can never overwrite another.
// v2 (one array for everyone) is read once by migrateAccounts and never written again.
const USERS_V2_KEY = "fleetdiag_users_v2";
const READY_KEY = "fleetdiag_users_v3_ready";
const ALL_USERS_KEY = "fleetdiag_user_ids_v3";
const DEVELOPERS_SET = "_developers";
const userKey = (id: string) => `fleetdiag_user_v3:${id}`;
const throttleKey = (id: string) => `fleetdiag_user_throttle_v3:${id}`;
// Attempt counters (atomic increment with an expiry) and lock times (a timestamp in ms), one key each per account.
const loginFailsKey = (id: string) => `fleetdiag_user_login_fails_v3:${id}`;
const loginLockKey = (id: string) => `fleetdiag_user_login_lock_v3:${id}`;
// One counter per reset code (named by the code's expiry time), so a new code always starts with
// fresh attempts, whether or not the old count could be cleared.
const otpAttemptsKey = (id: string, codeExpiresAt: number) => `fleetdiag_user_otp_attempts_v3:${id}:${codeExpiresAt}`;
const questionFailsKey = (id: string) => `fleetdiag_user_question_fails_v3:${id}`;
const questionLockKey = (id: string) => `fleetdiag_user_question_lock_v3:${id}`;
// Sign-in attempts from a known device (see knownDeviceId) are counted and locked per device.
const deviceFailsKey = (id: string, deviceId: string) => `fleetdiag_user_device_fails_v3:${id}:${deviceId}`;
const deviceLockKey = (id: string, deviceId: string) => `fleetdiag_user_device_lock_v3:${id}:${deviceId}`;
// Day counts of confirmed wrong passwords / answer sets (see DAILY_MAX_FAILURES).
const loginDailyKey = (id: string) => `fleetdiag_user_login_daily_v3:${id}`;
const deviceDailyKey = (id: string, deviceId: string) => `fleetdiag_user_device_daily_v3:${id}:${deviceId}`;
const questionDailyKey = (id: string) => `fleetdiag_user_question_daily_v3:${id}`;
// Hashed because the file backend maps every character outside [a-zA-Z0-9_-] to "_".
const loginKey = (identifier: string) =>
  `fleetdiag_user_login_v3:${crypto.createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex")}`;
const fleetUsersKey = (fleetId: string) => `fleetdiag_fleet_users_v3:${fleetId}`;
/** Read in place of a real account so a sign-in for an unknown name does the same store reads. Never created. */
const NO_ACCOUNT_ID = "usr-no-such-account";
export const MAX_USERS_PER_FLEET = 200;
export const MAX_USERS_PLATFORM = 5000;

type Env = Record<string, string | undefined>;

/**
 * True for the real public site: Vercel's production deployment, or any other NODE_ENV=production
 * server. Vercel sets NODE_ENV=production on previews too, so VERCEL_ENV decides there.
 */
export function isLiveDeployment(env: Env = process.env): boolean {
  return env.VERCEL ? env.VERCEL_ENV === "production" : env.NODE_ENV === "production";
}

/**
 * This prototype has no mail server, so a reset code can only be shown on screen, which hands it to
 * whoever asks. That is fine for a local demo and never acceptable on the live site, so
 * OTP_DEMO_MODE=true cannot turn it on there.
 */
export function otpEnabled(env: Env = process.env): boolean {
  if (isLiveDeployment(env)) return false;
  return env.OTP_DEMO_MODE ? env.OTP_DEMO_MODE === "true" : true;
}

const IS_LIVE = isLiveDeployment();
const OTP_ENABLED = otpEnabled();
if (IS_LIVE && process.env.OTP_DEMO_MODE === "true") {
  console.warn("[auth] OTP_DEMO_MODE=true is ignored on the live site: reset codes stay off.");
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = Object.fromEntries(
  Object.values(ROLE_CREDENTIALS).map((c) => [c.role, c.permissions ?? []])
) as Record<UserRole, string[]>;

const ROLE_LABELS: Record<UserRole, string> = {
  developer: "Lead Developer & Systems Architect",
  fleet_director: "Fleet Owner",
  fleet_manager: "Fleet Operations Manager",
  technician: "Diagnostic Technician",
  dispatcher: "Fleet Dispatcher",
};

const DEFAULT_QUESTIONS = [
  "What is the depot location of your primary fleet assignment?",
  "What is the surname of your direct workshop supervisor or director?",
  "What was the first commercial truck model you operated (e.g. Prima, Signa, LPT)?",
];

// Security answers for local demos ONLY. They are never used on the live site, because anyone who can read this code would know them.
// No passwords live in this file: see seedUsers().
const DEMO_ANSWERS: Record<UserRole, [string, string, string]> = {
  developer: ["Pune Engineering Bay", "Patil", "Tata Prima"],
  fleet_director: ["Interstate Freight Central Operations", "Mehta", "Tata Signa"],
  fleet_manager: ["Western Freight Corridor Hub", "Rao", "Tata LPT"],
  technician: ["Bay 3 Workshop Lead", "Iyer", "Turbotronn"],
  dispatcher: ["Highway Logistics Command", "Desai", "Interstate Night Corridor"],
};

// ------------------------------------------------------------------
// Session secret (env var > persisted in Redis > per-process random)
// ------------------------------------------------------------------
let sessionSecret: string | null =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 ? process.env.SESSION_SECRET : null;

async function getSessionSecret(): Promise<string> {
  if (sessionSecret) return sessionSecret;
  if (kv.kind === "redis") {
    // Shared across all serverless instances.
    let stored = await kv.get<string>(SECRET_KEY);
    if (!stored) {
      stored = crypto.randomBytes(48).toString("hex");
      await kv.set(SECRET_KEY, stored);
      // Re-read in case another instance won the race.
      stored = (await kv.get<string>(SECRET_KEY)) || stored;
    }
    sessionSecret = stored;
    return stored;
  }
  if (IS_PROD) {
    console.warn("[auth] SESSION_SECRET is not set; using a per-process random secret (sessions reset on restart).");
  }
  sessionSecret = crypto.randomBytes(48).toString("hex");
  return sessionSecret;
}

// ------------------------------------------------------------------
// Hashing helpers
// ------------------------------------------------------------------
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(secret, salt, 64, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  try {
    const [scheme, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, "base64");
    const actual = crypto.scryptSync(secret, Buffer.from(saltB64, "base64"), expected.length, SCRYPT_PARAMS);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// A dummy hash so that "unknown user" takes as long as "wrong password" (prevents user enumeration by timing).
const DUMMY_HASH = hashSecret(crypto.randomBytes(16).toString("hex"));

export function validatePasswordStrength(pw: unknown): string | null {
  if (typeof pw !== "string") return "Password is required.";
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 128) return "Password must be at most 128 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must contain both letters and numbers.";
  return null;
}

function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// ------------------------------------------------------------------
// User store
// ------------------------------------------------------------------
function seedUsers(): StoredUser[] {
  const disabled: string[] = [];
  const generated: string[] = [];
  const isLocal = !IS_LIVE && !process.env.VERCEL;
  const seeded = Object.values(ROLE_CREDENTIALS).map((cred) => {
    let password = process.env[`FLEETDIAG_PASSWORD_${cred.role.toUpperCase()}`];
    if (!password) {
      // A random value: nobody can sign in with it unless it's shown below, which only happens
      // in a local terminal. Hosted logs are never given a password.
      password = crypto.randomBytes(12).toString("base64url") + "7a";
      if (isLocal) generated.push(`${cred.email}  ->  ${password}`);
      else disabled.push(cred.role);
    }
    const answers = DEMO_ANSWERS[cred.role];
    const user: StoredUser = {
      id: `usr-${cred.role}-${cred.badgeNumber.toLowerCase()}`,
      email: cred.email.toLowerCase(),
      aliases: cred.aliases.map((a) => a.toLowerCase()),
      name: cred.name,
      role: cred.role,
      roleLabel: cred.roleLabel,
      badgeNumber: cred.badgeNumber,
      avatarColor: cred.avatarColor,
      shift: cred.shift,
      depot: cred.depot,
      ...(cred.role === "developer" ? {} : { fleetId: DEMO_FLEET_ID }),
      permissions: cred.permissions ?? [],
      passwordHash: hashSecret(password),
      passwordVersion: 1,
      // Live accounts start with no answers; each person sets their own after signing in.
      securityQuestions: IS_LIVE
        ? []
        : DEFAULT_QUESTIONS.map((q, i) => ({ question: q, answerHash: hashSecret(normalizeAnswer(answers[i])) })),
      createdAt: new Date().toISOString(),
    };
    return user;
  });
  if (disabled.length) console.warn(`[auth] Sign-in disabled until FLEETDIAG_PASSWORD_<ROLE> is set for: ${disabled.join(", ")}`);
  if (generated.length) {
    console.warn("[auth] No FLEETDIAG_PASSWORD_<ROLE> in .env, so these accounts got a random password:");
    generated.forEach((g) => console.warn(`        ${g}`));
  }
  return seeded;
}

/** Developers belong to no fleet, so they are kept in a set of their own. */
function membershipKey(u: { role: UserRole; fleetId?: string }): string {
  return fleetUsersKey(u.role === "developer" ? DEVELOPERS_SET : u.fleetId ?? DEMO_FLEET_ID);
}

function withoutThrottle(u: StoredUser): StoredUser {
  const copy: Record<string, unknown> = { ...u };
  for (const f of THROTTLE_FIELDS) delete copy[f];
  return copy as unknown as StoredUser;
}

/**
 * Copies the v2 array (or the seeded accounts) into one record per account. Every write is
 * set-if-absent or a set add, so a second run, a resumed run or two instances at once all reach
 * the same state and never overwrite a record changed since. v2 is read, never written.
 * Throttle state (lockouts, reset codes in flight) is not carried over.
 */
export async function migrateAccounts(): Promise<void> {
  if ((await kv.get(READY_KEY)) !== null) return;
  // A read error propagates, so ready() rejects and the next request tries again.
  const stored = await kv.get<unknown>(USERS_V2_KEY);
  let source: "v2" | "seed";
  let users: StoredUser[];
  if (stored === null || (Array.isArray(stored) && stored.length === 0)) {
    source = "seed";
    users = seedUsers();
  } else if (Array.isArray(stored)) {
    source = "v2";
    users = (stored as StoredUser[]).map((u) => ({
      ...u,
      aliases: Array.isArray(u.aliases) ? u.aliases : [],
      ...(u.role !== "developer" && !u.fleetId ? { fleetId: DEMO_FLEET_ID } : {}),
      ...(u.role === "fleet_director" ? { roleLabel: ROLE_LABELS.fleet_director } : {}),
    }));
  } else {
    // Seeding here would replace every real account with demo ones, and the marker would make it permanent.
    throw new Error(`[auth] ${USERS_V2_KEY} holds a ${typeof stored}, not an array of accounts; not migrating.`);
  }

  // Who owns each sign-in name is decided here, in array order, so the first account in v2 always
  // wins a name two accounts share, however the writes below interleave.
  const claims = new Map<string, string>();
  let collisions = 0;
  for (const u of users) {
    for (const identifier of new Set([u.email, ...u.aliases].map((x) => x.trim().toLowerCase()))) {
      if (!claims.has(identifier)) claims.set(identifier, u.id);
      else if (claims.get(identifier) !== u.id) collisions += 1;
    }
  }
  const claimList = [...claims];

  for (let i = 0; i < users.length; i += 20) {
    await Promise.all(users.slice(i, i + 20).map((u) => kv.setIfAbsent(userKey(u.id), withoutThrottle(u))));
  }
  for (let i = 0; i < claimList.length; i += 20) {
    const won = await Promise.all(
      claimList.slice(i, i + 20).map(async ([identifier, id]) => {
        if (await kv.setIfAbsent(loginKey(identifier), id)) return true;
        return (await kv.get<string>(loginKey(identifier))) === id; // ours already, from an earlier run
      })
    );
    collisions += won.filter((ok) => !ok).length;
  }
  for (let i = 0; i < users.length; i += 20) {
    await Promise.all(
      users.slice(i, i + 20).map(async (u) => {
        await kv.addToSet(membershipKey(u), u.id);
        await kv.addToSet(ALL_USERS_KEY, u.id);
      })
    );
  }
  if (collisions) console.warn(`[auth] Account migration: ${collisions} sign-in name(s) were claimed by more than one account; the first kept each.`);
  await kv.set(READY_KEY, { migratedAt: new Date().toISOString(), source, count: users.length, collisions });
}

let readyPromise: Promise<void> | null = null;

/** Runs the migration once per instance, on first use (never at import). A failure is retried next time. */
function ready(): Promise<void> {
  if (!readyPromise) {
    readyPromise = migrateAccounts().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

async function getUserById(id: string): Promise<StoredUser | null> {
  await ready();
  if (typeof id !== "string" || !id) return null;
  return kv.get<StoredUser>(userKey(id));
}

/** Email or alias only. Name and badge number are visible to others, so they never sign anyone in. */
/**
 * Extra sign-in names for the built-in accounts, from FLEETDIAG_LOGIN_ALIASES_<ROLE> (comma-separated,
 * e.g. "me@example.com,myname"). They live in the environment so personal emails never enter the code,
 * and they are read on every sign-in, so they also work for accounts created before they were set.
 */
export function envLoginAliases(env: NodeJS.ProcessEnv = process.env): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const cred of Object.values(ROLE_CREDENTIALS)) {
    const raw = env[`FLEETDIAG_LOGIN_ALIASES_${cred.role.toUpperCase()}`];
    if (!raw) continue;
    for (const a of raw.split(",")) {
      const name = a.trim().toLowerCase();
      if (name && name.length <= 254 && !aliases.has(name)) aliases.set(name, `usr-${cred.role}-${cred.badgeNumber.toLowerCase()}`);
    }
  }
  return aliases;
}

const ENV_LOGIN_ALIASES = envLoginAliases();

async function findUserByLogin(identifier: unknown): Promise<StoredUser | null> {
  if (typeof identifier !== "string") return null;
  const id = identifier.trim().toLowerCase();
  if (!id || id.length > 254) return null;
  await ready();
  const stored = await kv.get<string>(loginKey(id));
  // A name already claimed in the store always wins; an environment alias only fills a free name.
  const envId = stored ? undefined : ENV_LOGIN_ALIASES.get(id);
  const uid = stored || envId;
  // Read a record even when there is no match, so an unknown name costs the same store reads as a known one.
  const u = await getUserById(uid || NO_ACCOUNT_ID);
  if (!uid || !u) return null;
  if (envId) return u;
  if (!(u.email === id || u.aliases.includes(id))) return null;
  return u;
}

async function saveUser(u: StoredUser): Promise<void> {
  await kv.set(userKey(u.id), withoutThrottle(u));
}

async function getThrottle(id: string): Promise<UserThrottle> {
  const stored = await kv.get<UserThrottle>(throttleKey(id));
  return { otpHash: stored?.otpHash, otpExpiresAt: stored?.otpExpiresAt };
}

async function saveThrottle(id: string, t: UserThrottle): Promise<void> {
  await kv.set(throttleKey(id), t);
}

// ------------------------------------------------------------------
// Attempt counters and locks. The store holds them, so every instance sees the same numbers. If a
// counter or lock write fails, this process keeps them instead for that request (logged at most once
// a minute), so a store problem never answers 500 for a right code and never turns the lockout off.
// ------------------------------------------------------------------
const LOCAL_MAX_ENTRIES = 10_000;
const localCounters = new Map<string, { count: number; expiresAt: number }>();
const localLocks = new Map<string, number>();
let lastCounterWarningAt = 0;

function warnCounterFailure(err: unknown) {
  const now = Date.now();
  if (now - lastCounterWarningAt < 60 * 1000) return;
  lastCounterWarningAt = now;
  console.warn("[auth] Counter store unavailable; counting attempts in this instance's memory for now:", err);
}

/** Keeps a local map bounded: expired entries go first, then the oldest. */
function makeRoom<V>(map: Map<string, V>, expiresAt: (v: V) => number) {
  if (map.size < LOCAL_MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of map) if (expiresAt(v) <= now) map.delete(k);
  for (const k of map.keys()) {
    if (map.size < LOCAL_MAX_ENTRIES) break;
    map.delete(k);
  }
}

/** Adds one attempt and returns the count (atomic in the store; in this process if the store call fails). */
async function countAttempt(key: string, ttlSeconds: number): Promise<number> {
  try {
    return await kv.increment(key, ttlSeconds);
  } catch (err) {
    warnCounterFailure(err);
    const now = Date.now();
    const c = localCounters.get(key);
    const next = c && c.expiresAt > now ? { ...c, count: c.count + 1 } : { count: 1, expiresAt: now + ttlSeconds * 1000 };
    makeRoom(localCounters, (v) => v.expiresAt);
    localCounters.set(key, next);
    return next.count;
  }
}

/** How long a counter reset to 0 (because its delete failed) lives before it is gone altogether. */
const RESET_COUNTER_TTL_SECONDS = 60;

/**
 * Clears a count. If the delete fails, the counter is set back to 0 with a short expiry instead. If
 * that fails too, it is logged; nothing depends on it for the short counts, because such a count
 * expires before the lock it caused ends (see FAILED_COUNT_TTL_SECONDS) and a reset code's count dies
 * with the code. A day count does not expire before its lock; it is cleared on a right password or a
 * reset, and otherwise expires in a day.
 */
async function clearCount(key: string): Promise<void> {
  localCounters.delete(key);
  try {
    await kv.del(key);
  } catch (err) {
    warnCounterFailure(err);
    try {
      await kv.resetCounter(key, RESET_COUNTER_TTL_SECONDS);
    } catch (resetErr) {
      console.warn(`[auth] Could not clear the attempt count ${key}; it stays until it expires (within minutes):`, resetErr);
    }
  }
}

/**
 * Locks for `ms` (LOCKOUT_MS unless the day cap was reached) and returns the lock time. The store
 * key expires a minute after the lock. Only when the store write fails is the lock kept in this
 * process instead, so a lock cleared in the store (a password reset on any instance) is cleared everywhere.
 */
async function writeLock(key: string, ms = LOCKOUT_MS): Promise<number> {
  const until = Date.now() + ms;
  try {
    await kv.set(key, until, ms / 1000 + LOCK_KEY_EXTRA_SECONDS);
  } catch (err) {
    warnCounterFailure(err);
    makeRoom(localLocks, (v) => v);
    localLocks.set(key, until);
  }
  return until;
}

async function clearLock(key: string): Promise<void> {
  localLocks.delete(key);
  await kv.del(key);
}

/** A lock time in ms, or 0 when there is none. */
async function lockedUntil(key: string): Promise<number> {
  const v = await kv.get<number>(key);
  return Math.max(typeof v === "number" ? v : 0, localLocks.get(key) ?? 0);
}

function loginLockedResponse(res: Response, until: number) {
  const mins = Math.ceil((until - Date.now()) / 60000);
  return res.status(429).json({ error: `Too many failed attempts. Try again in ${mins} minute${mins > 1 ? "s" : ""}.` });
}

const QUESTIONS_LOCKED = "Too many attempts. Try again in a few minutes.";

/** Reads the account's fleet once (when it has one). */
async function fleetOf(u: StoredUser): Promise<Fleet | null> {
  const fleetId = resolveFleetId(u);
  return fleetId ? getFleet(fleetId) : null;
}

/** `fleet` is the account's resolved fleet, already read by the caller (see fleetOf). */
function toPublicUser(u: StoredUser, fleet: Fleet | null): AuthUser {
  const fleetId = resolveFleetId(u);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleLabel: u.roleLabel,
    badgeNumber: u.badgeNumber,
    avatarColor: u.avatarColor,
    shift: u.shift,
    depot: u.depot,
    permissions: [...u.permissions],
    hasSecurityQuestions: u.securityQuestions.length === 3,
    fleetId: fleetId ?? undefined,
    fleetName: fleet?.name,
    isDemoFleet: fleet?.isDemo,
  };
}

/** One fleet read per request: the refusal (if any) and the public user both come from it. */
async function sessionContext(u: StoredUser): Promise<{ fleet: Fleet | null; refusal: string | null; user: AuthUser }> {
  const fleet = await fleetOf(u);
  return { fleet, refusal: fleetRefusal(u, fleet), user: toPublicUser(u, fleet) };
}

// ------------------------------------------------------------------
// Accounts
// ------------------------------------------------------------------
export class AccountError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Shared by account creation and fleet creation, so a bad owner is rejected before a fleet exists. */
export function isValidAccountEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export async function isEmailTaken(email: string): Promise<boolean> {
  return !!(await findUserByLogin(email));
}

/** Creates an account and returns its one-time password. A developer has no fleet; everyone else needs a real one. */
export async function createAccount(input: {
  name: unknown;
  email: unknown;
  role: unknown;
  depot?: unknown;
  fleetId?: unknown;
}): Promise<{ user: AuthUser; temporaryPassword: string }> {
  const { name, email, role, depot, fleetId } = input;
  if (typeof name !== "string" || !name.trim() || name.length > 80) throw new AccountError("A valid name is required.", 400);
  if (!isValidAccountEmail(email)) {
    throw new AccountError("A valid email is required.", 400);
  }
  if (typeof role !== "string" || !Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)) throw new AccountError("Invalid role.", 400);
  let accountFleetId: string | undefined;
  if (role !== "developer") {
    if (typeof fleetId !== "string" || !fleetId) throw new AccountError("Add this user from the Fleets screen.", 400);
    if (!(await getFleet(fleetId))) throw new AccountError("That fleet does not exist.", 400);
    accountFleetId = fleetId;
  }
  const cleanEmail = email.trim().toLowerCase();
  const taken = () => new AccountError("An account with this email already exists.", 409);
  // Checked first so a duplicate gets the same answer as before; the claim below is what enforces it.
  if (await isEmailTaken(cleanEmail)) throw taken();
  const memberKey = membershipKey({ role: role as UserRole, fleetId: accountFleetId });
  if (accountFleetId && (await kv.setSize(memberKey)) >= MAX_USERS_PER_FLEET) {
    throw new AccountError("This fleet has reached its account limit.", 400);
  }
  if ((await kv.setSize(ALL_USERS_KEY)) >= MAX_USERS_PLATFORM) throw new AccountError("Account limit reached.", 400);

  const temporaryPassword = `${crypto.randomBytes(6).toString("base64url")}-${crypto.randomInt(10, 99)}`;
  const prefix = role === "fleet_director" ? "DIR" : role === "developer" ? "DEV" : "FD";
  const u: StoredUser = {
    id: `usr-${crypto.randomUUID()}`,
    email: cleanEmail,
    aliases: [],
    name: name.trim(),
    role: role as UserRole,
    roleLabel: ROLE_LABELS[role as UserRole],
    badgeNumber: `${prefix}-${crypto.randomInt(1000, 9999)}`,
    avatarColor: "bg-indigo-500 text-white font-bold",
    shift: "Commercial Operations",
    depot: typeof depot === "string" && depot.trim() ? depot.trim().slice(0, 120) : "Regional Operations Hub",
    ...(accountFleetId ? { fleetId: accountFleetId } : {}),
    permissions: [...(ROLE_PERMISSIONS[role as UserRole] || [])],
    passwordHash: hashSecret(temporaryPassword),
    passwordVersion: 1,
    securityQuestions: [],
    createdAt: new Date().toISOString(),
  };
  // Record first, then claim the email: a crash in between leaves an unreachable record, which is
  // harmless, whereas the reverse order could block the email forever.
  await kv.set(userKey(u.id), u);
  if (!(await kv.setIfAbsent(loginKey(cleanEmail), u.id))) {
    await kv.del(userKey(u.id));
    throw taken();
  }
  await kv.addToSet(memberKey, u.id);
  await kv.addToSet(ALL_USERS_KEY, u.id);
  return { user: toPublicUser(u, await fleetOf(u)), temporaryPassword };
}

/** Points a developer at the fleet they are viewing. */
export async function setActiveFleet(userId: string, fleetId: string): Promise<AuthUser | null> {
  const u = await getUserById(userId);
  if (!u) return null;
  u.activeFleetId = fleetId;
  await saveUser(u);
  return toPublicUser(u, await fleetOf(u));
}

/** Head count for each fleet asked for (0 when it has none); developers belong to none. */
export async function countUsersByFleet(fleetIds: string[]): Promise<Record<string, number>> {
  await ready();
  const sizes = await Promise.all(fleetIds.map((id) => kv.setSize(fleetUsersKey(id))));
  return Object.fromEntries(fleetIds.map((id, i) => [id, sizes[i]]));
}

/** The accounts in one fleet, as the app sees them. */
export async function listUsersInFleet(fleetId: string): Promise<AuthUser[]> {
  await ready();
  const [fleet, users] = await Promise.all([
    getFleet(fleetId),
    Promise.all((await kv.getSet(fleetUsersKey(fleetId))).map((id) => getUserById(id))),
  ]);
  return users.filter((u): u is StoredUser => !!u).map((u) => toPublicUser(u, fleet));
}

// ------------------------------------------------------------------
// Signed tokens (sessions + password-reset tokens)
// ------------------------------------------------------------------
interface TokenPayload {
  uid: string;
  pwv: number;
  typ: "session" | "reset" | "device";
  iat: number;
  exp: number;
  did?: string; // device tokens only: the random device ID
}

async function signToken(payload: TokenPayload): Promise<string> {
  const secret = await getSessionSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** The payload of a token of this type whose signature and expiry check out, or null. Never reads the store. */
async function readToken(token: unknown, typ: TokenPayload["typ"]): Promise<TokenPayload | null> {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const secret = await getSessionSecret();
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqualStr(sig, expected)) return null;
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (!payload || payload.typ !== typ || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.uid !== "string") return null;
  return payload;
}

/** Returns the user only if the signature, expiry, type and password version all check out. */
async function verifyToken(token: unknown, typ: TokenPayload["typ"]): Promise<StoredUser | null> {
  const payload = await readToken(token, typ);
  if (!payload) return null;
  // Loaded only after the signature checks out. A store error propagates (500), never a silent sign-out.
  const u = await getUserById(payload.uid);
  if (!u || u.passwordVersion !== payload.pwv) return null;
  return u;
}

function newPayload(u: StoredUser, typ: TokenPayload["typ"], ttlSeconds: number): TokenPayload {
  const now = Math.floor(Date.now() / 1000);
  return { uid: u.id, pwv: u.passwordVersion, typ, iat: now, exp: now + ttlSeconds };
}

function parseCookies(header: string | undefined): Record<string, string> {
  // Cookie names come from the client: a prototype-free object keeps "__proto__" a plain key.
  const out: Record<string, string> = Object.create(null);
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function cookieFlags(req: Request, path = "/"): string {
  const secure = IS_PROD || req.secure;
  return `Path=${path}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

/** One cookie name per account, from a keyed hash, so the name never shows the account ID. */
async function deviceCookieName(accountId: string): Promise<string> {
  const mac = crypto.createHmac("sha256", await getSessionSecret()).update(`dev:${accountId}`).digest("hex");
  return DEVICE_COOKIE_PREFIX + mac.slice(0, 16);
}

/**
 * The device ID of a valid known-device cookie for this account, or null: a cookie that is missing,
 * forged, malformed, expired, for another account or from before a password change counts as none.
 * Only the cookie named for this account is read; for an unknown name nothing is read. It never
 * reads the store.
 */
async function knownDeviceId(req: Request, u: StoredUser | null): Promise<string | null> {
  if (!u) return null;
  const token = parseCookies(req.headers.cookie)[await deviceCookieName(u.id)];
  const p = token ? await readToken(token, "device") : null;
  if (!p || p.uid !== u.id || p.pwv !== u.passwordVersion) return null;
  return typeof p.did === "string" && DEVICE_ID_PATTERN.test(p.did) ? p.did : null;
}

/**
 * Issued only after a correct password; keeps the device's ID when it already had one. If the
 * browser already holds MAX_DEVICE_COOKIES or more for other accounts, the extras are removed:
 * unreadable ones first, then the least recently used (by the time each was last issued).
 */
async function addDeviceCookie(req: Request, res: Response, u: StoredUser, deviceId: string | null) {
  const name = await deviceCookieName(u.id);
  const did = deviceId ?? crypto.randomBytes(16).toString("base64url");
  const token = await signToken({ ...newPayload(u, "device", DEVICE_TTL_SECONDS), did });
  res.append("Set-Cookie", `${name}=${token}; Max-Age=${DEVICE_TTL_SECONDS}; ${cookieFlags(req, DEVICE_COOKIE_PATH)}`);

  const cookies = parseCookies(req.headers.cookie);
  const others = Object.keys(cookies).filter((n) => n !== name && DEVICE_COOKIE_NAME_PATTERN.test(n));
  const excess = others.length - (MAX_DEVICE_COOKIES - 1);
  if (excess <= 0) return;
  const ranked = await Promise.all(
    others.map(async (n, i) => ({
      n,
      // -1 sorts first: unreadable, or beyond what is examined.
      iat: i < MAX_DEVICE_COOKIES_EXAMINED ? (await readToken(cookies[n], "device"))?.iat ?? -1 : -1,
    }))
  );
  ranked.sort((a, b) => a.iat - b.iat);
  for (const { n } of ranked.slice(0, Math.min(excess, MAX_DEVICE_COOKIE_REMOVALS))) {
    res.append("Set-Cookie", `${n}=; Max-Age=0; ${cookieFlags(req, DEVICE_COOKIE_PATH)}`);
  }
}

function setSessionCookie(req: Request, res: Response, token: string) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_SECONDS}; ${cookieFlags(req)}`);
}

function clearSessionCookie(req: Request, res: Response) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Max-Age=0; ${cookieFlags(req)}`);
}

async function getSessionUser(req: Request): Promise<StoredUser | null> {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7).trim() : parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  return verifyToken(token, "session");
}

// ------------------------------------------------------------------
// Middleware
// ------------------------------------------------------------------
/** Wraps async handlers so a rejected promise becomes a 500 instead of an unhandled rejection. */
function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      console.error("[auth] handler error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Authentication service error. Please try again." });
    });
  };
}

// requireAuth is a shared constant, so it gets the logger from registerAuthRoutes.
let sessionLog: SecurityLogger | undefined;

function logSessionRefusal(req: Request, email: string, refusal: string, action?: string) {
  sessionLog?.("UNAUTHORIZED_ACCESS_BLOCKED", "WARNING", req, `Session of ${email} refused: ${refusal}`, action);
}

export const requireAuth: RequestHandler = wrap(async (req, res, next) => {
  const u = await getSessionUser(req);
  if (!u) return res.status(401).json({ error: "Authentication required. Please sign in." });
  const { fleet, refusal, user } = await sessionContext(u);
  if (refusal) {
    logSessionRefusal(req, u.email, refusal);
    return sendFleetRefusal(res, refusal);
  }
  (req as AuthedRequest).user = user;
  if (fleet) (req as AuthedRequest).fleet = fleet; // requireFleet reuses it instead of reading again
  next();
});

export function requirePermission(permission: string, log?: SecurityLogger): RequestHandler {
  return (req, res, next) => {
    const user = (req as AuthedRequest).user;
    if (!user || !(user.permissions || []).includes(permission)) {
      log?.("UNAUTHORIZED_ACCESS_BLOCKED", "WARNING", req, `User '${user?.email ?? "anonymous"}' lacks permission '${permission}'`);
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

/** Blocks cross-site state-changing requests (defence in depth on top of SameSite=Strict cookies). */
export const sameOriginGuard: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser clients / some same-origin fetches
  try {
    const originHost = new URL(origin).host;
    const host = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0].trim() || req.headers.host;
    if (originHost === host) return next();
  } catch {
    // fall through
  }
  return res.status(403).json({ error: "Cross-origin request blocked." });
};

/** Routes under /api that may be called without a session. */
export const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/reset-options",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/security-questions",
  "/api/auth/verify-security-answers",
  "/api/auth/reset-password",
]);

export function apiAuthGate(req: Request, res: Response, next: NextFunction) {
  // Mounted at app level (not under "/api"), so req.path is the full path.
  // Express matches routes regardless of letter case, so the gate must too: /API/fleet is /api/fleet.
  const p = req.path.toLowerCase();
  if (!(p === "/api" || p.startsWith("/api/")) || PUBLIC_API_PATHS.has(p)) return next();
  return requireAuth(req, res, next);
}

// ------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------
async function hashOtp(code: string): Promise<string> {
  return crypto.createHmac("sha256", await getSessionSecret()).update(`otp:${code}`).digest("hex");
}

export function registerAuthRoutes(app: Express, opts: { rateLimiter: RequestHandler; log: SecurityLogger }) {
  const { rateLimiter, log } = opts;
  sessionLog = log;

  // --- Sign in ---
  app.post(
    "/api/auth/login",
    rateLimiter,
    wrap(async (req, res) => {
      const { identifier, email, password } = req.body || {};
      const id = identifier ?? email;
      if (typeof id !== "string" || typeof password !== "string" || !id.trim() || !password) {
        return res.status(400).json({ error: "Email/username and password are required." });
      }
      const u = await findUserByLogin(id);
      // A browser that signed in to this account before (a valid known-device cookie) is counted and
      // locked on its own: the account-wide lock is not checked for it and its failures never add to
      // the account-wide count, so strangers cannot lock the owner out of their own device, and the
      // owner's typos lock nobody else. Without such a cookie, nothing changes.
      const deviceId = await knownDeviceId(req, u);
      // The same lock read and attempt count for an unknown name (with the dummy hash below), so
      // timing does not reveal the account. Unknown names share one counter that never locks anything.
      const subject = u ? u.id : NO_ACCOUNT_ID;
      const lockKey = u && deviceId ? deviceLockKey(u.id, deviceId) : loginLockKey(subject);
      const failsKey = u && deviceId ? deviceFailsKey(u.id, deviceId) : loginFailsKey(subject);
      const dailyKey = u && deviceId ? deviceDailyKey(u.id, deviceId) : loginDailyKey(subject);
      const what = deviceId ? "known device of account" : "account";
      const lock = await lockedUntil(lockKey);

      if (u && lock > Date.now()) {
        log("AUTH_LOCKOUT", "WARNING", req, `Login attempt on locked ${what} ${u.email}`);
        return loginLockedResponse(res, lock);
      }

      // Counted before the password is checked, so a parallel burst gets at most MAX_FAILED_LOGINS checks.
      const attempts = await countAttempt(failsKey, FAILED_COUNT_TTL_SECONDS);
      if (u && attempts > MAX_FAILED_LOGINS) {
        const until = await writeLock(lockKey);
        log("AUTH_LOCKOUT", "WARNING", req, `Login attempt on locked ${what} ${u.email}`);
        return loginLockedResponse(res, until);
      }

      const ok = verifySecret(password, u ? u.passwordHash : DUMMY_HASH) && !!u;
      if (!ok || !u) {
        // The day count is only added to once the password is known to be wrong, and is never checked
        // before the password, so it cannot refuse a right one. Unknown names are counted too (same timing).
        const daily = await countAttempt(dailyKey, DAILY_COUNT_TTL_SECONDS);
        if (u && (attempts >= MAX_FAILED_LOGINS || daily >= DAILY_MAX_FAILURES)) {
          // Lock first, then clear the short count, so an interruption can only leave the account locked.
          await writeLock(lockKey, daily >= DAILY_MAX_FAILURES ? LONG_LOCKOUT_MS : LOCKOUT_MS);
          await clearCount(failsKey);
          log("AUTH_LOCKOUT", "WARNING", req, `${deviceId ? "Known device of account" : "Account"} ${u.email} locked after repeated failures`);
        }
        log("AUTH_FAILURE", "WARNING", req, `Failed sign-in for identifier '${String(id).slice(0, 64)}'`);
        return res.status(401).json({ error: "Incorrect email/username or password." });
      }

      await clearCount(failsKey);
      await clearCount(dailyKey);
      const { refusal, user } = await sessionContext(u);
      if (refusal) {
        log("AUTH_FAILURE", "WARNING", req, `Sign-in of ${u.email} refused: ${refusal}`);
        return sendFleetRefusal(res, refusal);
      }
      setSessionCookie(req, res, await signToken(newPayload(u, "session", SESSION_TTL_SECONDS)));
      await addDeviceCookie(req, res, u, deviceId);
      log("AUTH_SUCCESS", "INFO", req, `User signed in: ${u.email} (${u.role})`, "Session issued");
      return res.json({ status: "success", user });
    })
  );

  app.get(
    "/api/auth/me",
    wrap(async (req, res) => {
      const u = await getSessionUser(req);
      // 200 with user:null (not 401) so a normal signed-out visit doesn't log a console error.
      if (!u) return res.json({ user: null });
      const { refusal, user } = await sessionContext(u);
      if (refusal) {
        logSessionRefusal(req, u.email, refusal, "Treated as signed out");
        clearSessionCookie(req, res); // the reason is shown once, never to the next person on this browser
        return res.json({ user: null, reason: refusal });
      }
      return res.json({ user });
    })
  );

  app.post("/api/auth/logout", (req, res) => {
    clearSessionCookie(req, res);
    return res.json({ status: "signed_out" });
  });

  // --- Password reset via one-time code (never on the live site, see otpEnabled) ---
  const OTP_UNAVAILABLE = "Reset codes aren't available on this site. Use your security questions instead.";

  app.get("/api/auth/reset-options", (_req, res) => res.json({ otp: OTP_ENABLED }));

  app.post(
    "/api/auth/send-otp",
    rateLimiter,
    wrap(async (req, res) => {
      if (!OTP_ENABLED) return res.status(404).json({ error: OTP_UNAVAILABLE });
      const u = await findUserByLogin(req.body?.identifier);
      const response: Record<string, unknown> = {
        status: "sent",
        message: "If an account matches, a 6-digit code has been sent. It expires in 10 minutes.",
        expiresInSeconds: OTP_TTL_MS / 1000,
      };
      if (u) {
        const code = crypto.randomInt(100000, 1000000).toString();
        // A new code has a counter of its own (see otpAttemptsKey), so it starts with fresh attempts.
        await saveThrottle(u.id, { otpHash: await hashOtp(code), otpExpiresAt: Date.now() + OTP_TTL_MS });
        log("AUTH_SUCCESS", "INFO", req, `Password-reset code issued for ${u.email}`, "OTP generated");
        // No mail server in this prototype, so the code goes back on screen (local demos only).
        response.demoOtp = code;
        response.email = u.email;
      }
      return res.json(response);
    })
  );

  app.post(
    "/api/auth/verify-otp",
    rateLimiter,
    wrap(async (req, res) => {
      if (!OTP_ENABLED) return res.status(404).json({ error: OTP_UNAVAILABLE });
      const u = await findUserByLogin(req.body?.identifier);
      const t = u ? await getThrottle(u.id) : null;
      const code = String(req.body?.code ?? "").trim();
      if (!u || !t || !t.otpHash || !t.otpExpiresAt || t.otpExpiresAt < Date.now()) {
        return res.status(400).json({ error: "This code is invalid or has expired. Request a new one." });
      }
      // Counted before the code is checked, as before: a right code on the sixth try is still refused.
      const attempts = await countAttempt(otpAttemptsKey(u.id, t.otpExpiresAt), OTP_TTL_MS / 1000);
      if (attempts > MAX_OTP_ATTEMPTS) {
        await saveThrottle(u.id, {});
        log("AUTH_LOCKOUT", "WARNING", req, `Too many OTP attempts for ${u.email}`);
        return res.status(429).json({ error: "Too many attempts. Request a new code." });
      }
      if (!/^\d{6}$/.test(code) || !safeEqualStr(await hashOtp(code), t.otpHash)) {
        log("AUTH_FAILURE", "WARNING", req, `Incorrect OTP for ${u.email} (attempt ${attempts}/5)`);
        return res.status(400).json({ error: `Incorrect code. ${MAX_OTP_ATTEMPTS - attempts} attempt(s) left.` });
      }
      // The code is spent, and its counter is never read again (it expires with the code).
      await saveThrottle(u.id, {});
      return res.json({ status: "verified", resetToken: await signToken(newPayload(u, "reset", RESET_TOKEN_TTL_SECONDS)) });
    })
  );

  // --- Password reset via security questions ---
  app.post(
    "/api/auth/security-questions",
    rateLimiter,
    wrap(async (req, res) => {
      const u = await findUserByLogin(req.body?.identifier);
      // Default questions for unknown users so the response doesn't reveal whether an account exists.
      const questions = u && u.securityQuestions.length === 3 ? u.securityQuestions.map((q) => q.question) : DEFAULT_QUESTIONS;
      return res.json({ questions });
    })
  );

  app.post(
    "/api/auth/verify-security-answers",
    rateLimiter,
    wrap(async (req, res) => {
      const answers = req.body?.answers;
      if (!Array.isArray(answers) || answers.length !== 3 || answers.some((a) => typeof a !== "string" || a.length > 200)) {
        return res.status(400).json({ error: "Please answer all three questions." });
      }
      const u = await findUserByLogin(req.body?.identifier);
      if (!u || u.securityQuestions.length !== 3) {
        verifySecret("x", DUMMY_HASH);
        return res.status(400).json({ error: "Those answers don't match our records." });
      }
      if ((await lockedUntil(questionLockKey(u.id))) > Date.now()) {
        return res.status(429).json({ error: QUESTIONS_LOCKED });
      }
      // Counted before the answers are checked, so a parallel burst gets at most MAX_QUESTION_ATTEMPTS checks.
      const attempts = await countAttempt(questionFailsKey(u.id), FAILED_COUNT_TTL_SECONDS);
      if (attempts > MAX_QUESTION_ATTEMPTS) {
        await writeLock(questionLockKey(u.id));
        return res.status(429).json({ error: QUESTIONS_LOCKED });
      }
      const allMatch = u.securityQuestions.every((q, i) => verifySecret(normalizeAnswer(answers[i]), q.answerHash));
      if (!allMatch) {
        // The day count is only added to once the answers are known to be wrong, and is never checked before.
        const daily = await countAttempt(questionDailyKey(u.id), DAILY_COUNT_TTL_SECONDS);
        if (attempts >= MAX_QUESTION_ATTEMPTS || daily >= DAILY_MAX_FAILURES) {
          await writeLock(questionLockKey(u.id), daily >= DAILY_MAX_FAILURES ? LONG_LOCKOUT_MS : LOCKOUT_MS);
          await clearCount(questionFailsKey(u.id));
          log("AUTH_LOCKOUT", "WARNING", req, `Security answers for ${u.email} locked after repeated failures`);
        }
        log("AUTH_FAILURE", "WARNING", req, `Incorrect security answers for ${u.email}`);
        return res.status(400).json({ error: "Those answers don't match our records." });
      }
      await clearCount(questionFailsKey(u.id));
      await clearCount(questionDailyKey(u.id));
      return res.json({ status: "verified", resetToken: await signToken(newPayload(u, "reset", RESET_TOKEN_TTL_SECONDS)) });
    })
  );

  app.post(
    "/api/auth/reset-password",
    rateLimiter,
    wrap(async (req, res) => {
      const { resetToken, newPassword } = req.body || {};
      const strengthError = validatePasswordStrength(newPassword);
      if (strengthError) return res.status(400).json({ error: strengthError });
      // The token embeds the password version, so it stops working as soon as it has been used.
      const u = await verifyToken(resetToken, "reset");
      if (!u) {
        log("AUTH_FAILURE", "WARNING", req, "Password reset attempted with an invalid or expired token");
        return res.status(400).json({ error: "Your verification has expired. Please start again." });
      }
      u.passwordHash = hashSecret(newPassword);
      u.passwordVersion += 1; // signs out every existing session and invalidates the reset token
      await saveUser(u);
      await clearLock(loginLockKey(u.id));
      await clearCount(loginFailsKey(u.id));
      await clearCount(loginDailyKey(u.id));
      log("AUTH_SUCCESS", "INFO", req, `Password reset for ${u.email}`, "Password updated, sessions revoked");
      return res.json({ status: "success", message: "Password updated. You can now sign in." });
    })
  );

  // --- Signed-in user: update own security questions ---
  app.post(
    "/api/security/save-questions",
    requireAuth,
    rateLimiter,
    wrap(async (req, res) => {
      const me = (req as AuthedRequest).user!;
      const { q1, a1, q2, a2, q3, a3 } = req.body || {};
      const qs = [q1, q2, q3];
      const as = [a1, a2, a3];
      if (
        qs.some((q) => typeof q !== "string" || !q.trim() || q.length > 300) ||
        as.some((a) => typeof a !== "string" || a.trim().length < 4 || a.length > 200)
      ) {
        return res.status(400).json({ error: "Please choose three questions and give answers of at least 4 characters." });
      }
      // Badge, email and name are visible to other users, so they would be guessable answers.
      const publicFacts = [me.badgeNumber, me.email, me.name].map(normalizeAnswer);
      if (as.some((a) => publicFacts.includes(normalizeAnswer(a)))) {
        return res.status(400).json({ error: "Answers can't be your badge number, email or name, because other people can see those." });
      }
      if (new Set(qs).size !== 3) return res.status(400).json({ error: "Please choose three different questions." });
      const u = await getUserById(me.id);
      if (!u) return res.status(404).json({ error: "Account not found." });
      u.securityQuestions = qs.map((q, i) => ({ question: q.trim(), answerHash: hashSecret(normalizeAnswer(as[i])) }));
      await saveUser(u);
      log("AUTH_SUCCESS", "INFO", req, `Security questions updated for ${u.email}`, "Stored as scrypt hashes");
      return res.json({ status: "success" });
    })
  );

  // --- Create an operator account (approval of an access request) ---
  app.post(
    "/api/auth/accounts",
    requireAuth,
    requirePermission("approve_access_requests", log),
    rateLimiter,
    wrap(async (req, res) => {
      const me = (req as AuthedRequest).user!;
      const { name, email, role, depot, fleetId } = req.body || {};
      // Privilege escalation guard
      if (role === "developer" && me.role !== "developer") return res.status(403).json({ error: "Only a developer can grant developer access." });
      if (role === "fleet_director" && !["developer", "fleet_director"].includes(me.role)) {
        return res.status(403).json({ error: "Only a director can grant director access." });
      }
      try {
        // Only a developer may choose the fleet; everyone else adds people to their own.
        const { user, temporaryPassword } = await createAccount({
          name,
          email,
          role,
          depot,
          fleetId: me.role === "developer" ? fleetId : me.fleetId,
        });
        log("AUTH_SUCCESS", "INFO", req, `${me.email} created account ${user.email} (${user.role})`, "Account created");
        return res.status(201).json({ status: "created", user, temporaryPassword });
      } catch (err) {
        if (err instanceof AccountError) return res.status(err.status).json({ error: err.message });
        throw err;
      }
    })
  );
}

/** Used by the built-in penetration self-test: a tampered session token must be rejected. */
export async function sessionForgeryIsRejected(): Promise<{ defended: boolean; sample: string }> {
  await ready();
  const [firstId] = await kv.getSet(ALL_USERS_KEY);
  const u = firstId ? await getUserById(firstId) : null;
  if (!u) return { defended: true, sample: "" };
  const [, sig] = (await signToken(newPayload(u, "session", 60))).split(".");
  const forgedBody = Buffer.from(
    JSON.stringify({ uid: u.id, role: "super_admin_god_mode", pwv: u.passwordVersion, typ: "session", iat: 0, exp: 9999999999 })
  ).toString("base64url");
  const forged = `${forgedBody}.${sig}`;
  return { defended: (await verifyToken(forged, "session")) === null, sample: forged.slice(0, 32) + "..." };
}

/** Where account data is kept — shown in startup logs / health output. */
export const authStoreKind = kv.kind;
