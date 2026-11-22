# Security Specification & Threat Model for FleetDiag AI

## 1. Architecture
Browsers never talk to a database. Every read and write goes through the Express API, which requires a signed session cookie for everything except sign-in, password reset and the health check. Data is stored server-side in Upstash Redis on Vercel, or in JSON files under `data/` on a local run.

Firestore is no longer used. `firestore.rules` denies all access, so the old database can't be read or changed from a browser once those rules are published.

## 2. Data Invariants
Enforced by `validateVehiclePayload` and the record checks in `server.ts`:
- **Vehicle:** ID matches `^[a-zA-Z0-9_\-]+$` and is at most 64 characters, status is one of the allowed values, and health score is 0-100.
- **Records:** each stored record has a size limit, and every collection has a maximum length.
- **Default deny:** every `/api` route needs a session unless it's on the public list in `server/auth.ts`. Admin routes also need the `developer_console` permission.

## 3. Accounts
- Passwords and security answers are stored only as salted scrypt hashes.
- No password exists in this repository. Accounts get theirs from `FLEETDIAG_PASSWORD_<ROLE>`.
- On the live site, reset codes are off and accounts start with no security answers, so each person sets their own.

## 4. The Dirty Dozen Malicious Payloads
1. **Ghost Field Poisoning:** vehicle payload with extra property `adminOverride: true`.
2. **Path Traversal / Junk ID:** vehicle ID `../../root/junk-id-buffer-overflow`.
3. **Huge String Attack (Denial of Wallet):** a request body over the 100 KB limit.
4. **Status Enum Tampering:** status set to `SUPER_ADMIN_BYPASS`.
5. **Negative Health Score:** `health_score: -50`.
6. **Health Score Overflow:** `health_score: 99999`.
7. **Oversized Record:** a single record over the 20 KB storage limit.
8. **Script Injection:** `<script>` tags in a payload, which the sanitizer strips.
9. **Unauthenticated Write:** any write without a valid session.
10. **Prototype Pollution:** `__proto__` keys in a JSON body.
11. **Forged Session:** a tampered session token.
12. **Privilege Bypass:** a signed-in technician calling a developer-only route.

## 5. Test Runner
`npm test` runs these checks against the real Express app. Every payload must be rejected.
