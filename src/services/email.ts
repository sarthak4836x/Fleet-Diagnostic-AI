// Password-reset one-time codes.
//
// Codes are generated, stored and verified ONLY on the server. This prototype has no
// mail server, so in development (or with OTP_DEMO_MODE=true) the server returns the
// code and we show it in a simulated inbox. In production the code is never sent to the
// browser.

export interface SentEmailRecord {
  id: string;
  to: string;
  from: string;
  subject: string;
  otpCode: string;
  sentAt: string;
  expiresAt: string;
}

export interface SendOtpResult {
  success: boolean;
  message: string;
  expiresInSeconds: number;
  emailRecord: SentEmailRecord | null;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  resetToken?: string;
}

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

export async function sendPasswordResetOtpEmail(identifier: string): Promise<SendOtpResult> {
  const { ok, data } = await postJson('/api/auth/send-otp', { identifier: identifier.trim() });
  if (!ok) throw new Error(data.error || data.message || 'Could not send a verification code.');

  const expiresInSeconds = Number(data.expiresInSeconds) || 600;
  let emailRecord: SentEmailRecord | null = null;
  if (typeof data.demoOtp === 'string') {
    const now = Date.now();
    emailRecord = {
      id: `email-${now}`,
      to: data.email || identifier,
      from: 'security@fleetdiag.app',
      subject: 'Your FleetDiag verification code',
      otpCode: data.demoOtp,
      sentAt: new Date(now).toISOString(),
      expiresAt: new Date(now + expiresInSeconds * 1000).toISOString(),
    };
  }
  return { success: true, message: data.message, expiresInSeconds, emailRecord };
}

export async function verifyPasswordResetOtp(identifier: string, enteredCode: string): Promise<VerifyOtpResult> {
  const code = enteredCode.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) {
    return { success: false, message: 'Enter the 6-digit code.' };
  }
  try {
    const { ok, data } = await postJson('/api/auth/verify-otp', { identifier: identifier.trim(), code });
    if (ok && data.resetToken) return { success: true, message: 'Code confirmed.', resetToken: data.resetToken };
    return { success: false, message: data.error || 'Invalid code. Please try again.' };
  } catch {
    return { success: false, message: 'Unable to reach the server.' };
  }
}

/** Kept for API compatibility; codes are single-use on the server. */
export function clearActiveOtp(_identifier: string): void {}
