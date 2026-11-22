// Security questions — client helpers.
//
// Answers are sent over HTTPS to the server, which stores them only as salted scrypt
// hashes and does all verification. Nothing secret is kept in the browser
// (the previous version stored hashes in localStorage and verified them client-side,
// which anyone could bypass from DevTools).

export interface SecurityQuestionConfig {
  id: string;
  category: 'depot' | 'identity' | 'technical';
  text: string;
}

export const PRESET_SECURITY_QUESTIONS: SecurityQuestionConfig[] = [
  { id: 'q_depot_first', category: 'depot', text: 'What is the depot location of your primary fleet assignment?' },
  { id: 'q_depot_mentor', category: 'depot', text: 'What was the workshop bay or station of your first shift?' },
  { id: 'q_depot_city', category: 'depot', text: 'In what city is your regional commercial transport hub located?' },
  { id: 'q_supervisor', category: 'identity', text: 'What is the surname of your direct workshop supervisor or director?' },
  { id: 'q_radio_call', category: 'identity', text: 'What is your assigned corridor radio callsign or dispatch handle?' },
  { id: 'q_truck_model', category: 'technical', text: 'What was the first commercial truck model you operated (e.g. Prima, Signa, LPT)?' },
  { id: 'q_engine_type', category: 'technical', text: 'What is your preferred diesel engine platform (e.g. Turbotronn, Cummins, MD1CS018)?' },
  { id: 'q_recovery_phrase', category: 'technical', text: 'What is your confidential personal operator recovery phrase?' },
];

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** Save the signed-in user's three security questions (hashed server-side). */
export async function saveUserSecurityQuestions(
  _email: string,
  q1: string,
  a1: string,
  q2: string,
  a2: string,
  q3: string,
  a3: string
): Promise<void> {
  const { ok, data } = await postJson('/api/security/save-questions', { q1, a1, q2, a2, q3, a3 });
  if (!ok) throw new Error(data.error || 'Failed to save security questions.');
}

/** Which reset methods this site offers. If the check fails, assume codes are off. */
export async function getResetOptions(): Promise<{ otp: boolean }> {
  try {
    const res = await fetch('/api/auth/reset-options', { credentials: 'same-origin' });
    const data = await res.json();
    return { otp: res.ok && data.otp === true };
  } catch {
    return { otp: false };
  }
}

/** Fetch the three questions for an account (never the answers). */
export async function getUserSecurityQuestions(identifier: string): Promise<{
  found: boolean;
  q1: string;
  q2: string;
  q3: string;
}> {
  try {
    const { ok, data } = await postJson('/api/auth/security-questions', { identifier });
    if (ok && Array.isArray(data.questions) && data.questions.length === 3) {
      return { found: true, q1: data.questions[0], q2: data.questions[1], q3: data.questions[2] };
    }
  } catch {
    // fall through
  }
  return { found: false, q1: '', q2: '', q3: '' };
}

/** Verify all three answers on the server. Returns a short-lived reset token on success. */
export async function verifySecurityAnswers(
  identifier: string,
  answers: [string, string, string]
): Promise<{ success: boolean; error?: string; resetToken?: string }> {
  try {
    const { ok, data } = await postJson('/api/auth/verify-security-answers', { identifier, answers });
    if (ok && data.resetToken) return { success: true, resetToken: data.resetToken };
    return { success: false, error: data.error || "Those answers don't match our records." };
  } catch {
    return { success: false, error: 'Unable to reach the server.' };
  }
}

/** Set a new password using a reset token from OTP or security-question verification. */
export async function resetPasswordWithToken(
  resetToken: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { ok, data } = await postJson('/api/auth/reset-password', { resetToken, newPassword });
    if (ok) return { success: true };
    return { success: false, error: data.error || 'Failed to update password.' };
  } catch {
    return { success: false, error: 'Unable to reach the server.' };
  }
}

/** Same rules the server enforces. */
export function passwordStrengthError(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 128) return 'Password must be at most 128 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain both letters and numbers.';
  return null;
}
