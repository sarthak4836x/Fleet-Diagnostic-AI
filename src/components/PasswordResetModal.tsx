import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  KeyRound,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Inbox,
  Copy,
  Check,
  Send,
} from 'lucide-react';
import {
  getResetOptions,
  getUserSecurityQuestions,
  verifySecurityAnswers,
  resetPasswordWithToken,
  passwordStrengthError,
} from '../utils/cryptoSecurity';
import {
  sendPasswordResetOtpEmail,
  verifyPasswordResetOtp,
  clearActiveOtp,
  SentEmailRecord,
} from '../services/email';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIdentifier?: string;
  onSuccessLogin?: (email: string) => void;
}

type ResetMethod = 'email' | 'questions';

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  isOpen,
  onClose,
  initialIdentifier = '',
  onSuccessLogin,
}) => {
  const [step, setStep] = useState<'identify' | 'email_otp' | 'security_questions' | 'set_new_password' | 'success'>('identify');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  // Start on questions: the code option only appears once the server confirms this site offers it.
  const [method, setMethod] = useState<ResetMethod>('questions');
  const [otpAvailable, setOtpAvailable] = useState(false);

  // Email-based OTP States
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [latestEmailRecord, setLatestEmailRecord] = useState<SentEmailRecord | null>(null);
  const [hasCopiedOtp, setHasCopiedOtp] = useState(false);

  // 3 Security Questions States
  const [q1, setQ1] = useState('');
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState('');
  const [a2, setA2] = useState('');
  const [q3, setQ3] = useState('');
  const [a3, setA3] = useState('');
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [isVerifyingQuestions, setIsVerifyingQuestions] = useState(false);

  // New Password Form States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Short-lived, single-use token issued by the server after OTP / security-question verification
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    if (initialIdentifier) {
      setIdentifier(initialIdentifier);
    }
  }, [initialIdentifier]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getResetOptions().then(({ otp }) => {
      if (cancelled) return;
      setOtpAvailable(otp);
      setMethod(otp ? 'email' : 'questions');
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Listen for simulated email dispatch events
  useEffect(() => {
    const handleEmailDispatched = (e: Event) => {
      const custom = e as CustomEvent<SentEmailRecord>;
      if (custom.detail) {
        setLatestEmailRecord(custom.detail);
      }
    };
    window.addEventListener('fleetdiag:email-sent', handleEmailDispatched);
    return () => window.removeEventListener('fleetdiag:email-sent', handleEmailDispatched);
  }, []);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  // The server resolves usernames / badge numbers / emails, so send the identifier as typed.
  const getResolvedEmail = (id: string): string => id.trim();

  const resolvedEmail = getResolvedEmail(identifier);

  // STEP 1: Handle Initial Selection
  const handleProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    const targetEmail = getResolvedEmail(identifier);

    if (method === 'email') {
      setIsSendingEmail(true);
      setOtpError(null);
      setEnteredOtp('');

      try {
        const res = await sendPasswordResetOtpEmail(targetEmail);
        setLatestEmailRecord(res.emailRecord);
        setResendCooldown(res.expiresInSeconds ? 60 : 60);
        setStep('email_otp');
      } catch (err: any) {
        setOtpError(err.message || 'Failed to dispatch verification email.');
      } finally {
        setIsSendingEmail(false);
      }
    } else {
      // 3 Security Questions flow (checked on the server)
      const qSet = await getUserSecurityQuestions(targetEmail);
      setQ1(qSet.q1);
      setQ2(qSet.q2);
      setQ3(qSet.q3);
      setQuestionsError(null);
      setStep('security_questions');
    }
  };

  // STEP 2A: Verify 6-digit OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const cleanCode = enteredOtp.trim().replace(/\s+/g, '');
    if (cleanCode.length !== 6) {
      setOtpError('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    const targetEmail = getResolvedEmail(identifier);

    try {
      const result = await verifyPasswordResetOtp(targetEmail, cleanCode);
      if (result.success && result.resetToken) {
        setResetToken(result.resetToken);
        setStep('set_new_password');
      } else {
        setOtpError(result.message);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingEmail) return;
    setIsSendingEmail(true);
    setOtpError(null);
    const targetEmail = getResolvedEmail(identifier);

    try {
      const res = await sendPasswordResetOtpEmail(targetEmail);
      setLatestEmailRecord(res.emailRecord);
      setResendCooldown(60);
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCopyOtp = (code: string) => {
    navigator.clipboard.writeText(code);
    setHasCopiedOtp(true);
    setEnteredOtp(code);
    setTimeout(() => setHasCopiedOtp(false), 2000);
  };

  // STEP 2B: Verify 3 Security Questions on the server
  const handleVerify3Questions = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuestionsError(null);
    setIsVerifyingQuestions(true);

    const targetEmail = getResolvedEmail(identifier);

    try {
      // All three answers are checked on the server against salted scrypt hashes.
      const result = await verifySecurityAnswers(targetEmail, [a1, a2, a3]);
      if (result.success && result.resetToken) {
        setResetToken(result.resetToken);
        setStep('set_new_password');
      } else {
        setQuestionsError(result.error || "Those answers don't match our records.");
      }
    } catch {
      setQuestionsError('Cryptographic verification failed. Please try again.');
    } finally {
      setIsVerifyingQuestions(false);
    }
  };

  // STEP 3: Submit New Password
  const handleSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    const strengthError = passwordStrengthError(newPassword);
    if (strengthError) {
      setPasswordError(strengthError);
      return;
    }
    if (!resetToken) {
      setPasswordError('Your verification has expired. Please start again.');
      setStep('identify');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    const targetEmail = getResolvedEmail(identifier);

    try {
      const result = await resetPasswordWithToken(resetToken, newPassword);
      setResetToken(null);
      if (!result.success) {
        setPasswordError(result.error || 'Failed to update password.');
        return;
      }
      clearActiveOtp(targetEmail);
      setStep('success');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    onClose();
    if (onSuccessLogin) {
      onSuccessLogin(getResolvedEmail(identifier));
    }
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden font-sans my-auto"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                Operator Password Recovery
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Verify your identity to set a new password
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close popup"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[82vh] overflow-y-auto custom-scrollbar-thin">
          {/* STEP 1: Enter Email & Select Recovery Method */}
          {step === 'identify' && (
            <form onSubmit={handleProceed} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  Enter Your Operator Email Address:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-2xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-2">
                  Select Verification Method:
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {/* Method 1: Email-Based 6-Digit OTP (local demos only) */}
                  {otpAvailable && (
                  <label
                    onClick={() => setMethod('email')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      method === 'email'
                        ? 'bg-amber-400/10 border-amber-400/50 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="text-xs flex-1">
                      <div className="font-bold text-white font-mono flex items-center gap-2">
                        <span>Email-Based 6-Digit OTP Verification</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Recommended
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Simulates sending a 6-digit one-time passcode to {resolvedEmail || 'your email id'}. You will validate the code before setting a new password.
                      </div>
                    </div>
                  </label>
                  )}

                  {/* Method 2: 3 Security Questions */}
                  <label
                    onClick={() => setMethod('questions')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      method === 'questions'
                        ? 'bg-amber-400/10 border-amber-400/50 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-cyan-400/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="text-xs flex-1">
                      <div className="font-bold text-white font-mono flex items-center gap-2">
                        <span>3 Operator Security Questions</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Hashed on server
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Verify identity by answering your 3 security questions (Depot, Operator Identity, Vehicle).
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingEmail || !identifier.trim()}
                className="w-full mt-2 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-400/15 transition-all cursor-pointer font-mono"
              >
                {isSendingEmail ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatching 6-Digit OTP...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {method === 'email' ? 'Send 6-Digit OTP Code' : 'Continue with 3 Security Questions'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2A: Email-Based 6-Digit OTP Input & Validation */}
          {step === 'email_otp' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>Verification sent to: <strong className="text-white">{resolvedEmail}</strong></span>
                <button
                  type="button"
                  onClick={() => setStep('identify')}
                  className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" /> Change
                </button>
              </div>

              {/* Simulated Email Received Banner */}
              {latestEmailRecord && (
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/20">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold">
                      <Inbox className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Simulated Email Received (Inbox Simulation)</span>
                    </div>
                    <span className="text-[10px] text-cyan-400/80 bg-cyan-500/20 px-2 py-0.5 rounded-full">
                      Valid 10 min
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div><strong>From:</strong> {latestEmailRecord.from}</div>
                    <div><strong>Subject:</strong> {latestEmailRecord.subject}</div>
                  </div>

                  {/* One-click OTP copy & fill */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Verification Code:</span>
                      <span className="font-mono text-base font-extrabold text-amber-400 tracking-wider">
                        {latestEmailRecord.otpCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyOtp(latestEmailRecord.otpCode)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {hasCopiedOtp ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Filled!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Fill in Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {otpError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              {/* Form to enter and validate OTP */}
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                    Enter the 6-Digit OTP Code:
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    className="w-full py-3 px-4 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-2xl text-center text-xl font-bold font-mono tracking-widest text-amber-400 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
                    autoFocus
                    required
                  />
                  <p className="text-[11px] text-slate-500 font-mono mt-1 text-center">
                    Enter the 6 numeric digits sent to your email
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingOtp || enteredOtp.trim().length !== 6}
                  className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-400/15 transition-all cursor-pointer font-mono"
                >
                  {isVerifyingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Validating Secret OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Validate OTP & Set New Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Resend and Fallback actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs font-mono">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isSendingEmail}
                  className="text-slate-400 hover:text-white disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const qSet = await getUserSecurityQuestions(resolvedEmail);
                    setQ1(qSet.q1);
                    setQ2(qSet.q2);
                    setQ3(qSet.q3);
                    setQuestionsError(null);
                    setStep('security_questions');
                  }}
                  className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Use 3 Security Questions</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2B: 3 Security Questions (Zero-Plaintext) */}
          {step === 'security_questions' && (
            <form onSubmit={handleVerify3Questions} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>Account: <strong className="text-white">{resolvedEmail}</strong></span>
                <button
                  type="button"
                  onClick={() => setStep('identify')}
                  className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" /> Change
                </button>
              </div>

              {/* Security Banner */}
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Cryptographic Multi-Question Verification</div>
                  <div className="text-[11px] text-slate-300/90 mt-0.5">
                    Answer your 3 security questions. Your answers are checked on the server against salted hashes.
                  </div>
                </div>
              </div>

              {questionsError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{questionsError}</span>
                </div>
              )}

              {/* Question 1 */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  Question 1: Depot & Logistics
                </span>
                <p className="text-xs font-mono text-slate-200">{q1}</p>
                <input
                  type="password"
                  value={a1}
                  onChange={(e) => setA1(e.target.value)}
                  placeholder="Enter answer for Question 1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              {/* Question 2 */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  Question 2: Operator Identity
                </span>
                <p className="text-xs font-mono text-slate-200">{q2}</p>
                <input
                  type="password"
                  value={a2}
                  onChange={(e) => setA2(e.target.value)}
                  placeholder="Enter answer for Question 2"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                  required
                />
              </div>

              {/* Question 3 */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  Question 3: Vehicle & Powertrain
                </span>
                <p className="text-xs font-mono text-slate-200">{q3}</p>
                <input
                  type="password"
                  value={a3}
                  onChange={(e) => setA3(e.target.value)}
                  placeholder="Enter answer for Question 3"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('email_otp')}
                  className="px-4 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Use OTP</span>
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingQuestions || !a1.trim() || !a2.trim() || !a3.trim()}
                  className="flex-1 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-400/15 transition-all cursor-pointer font-mono"
                >
                  {isVerifyingQuestions ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Hashes...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify Hashes & Set Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Set New Password */}
          {step === 'set_new_password' && (
            <form onSubmit={handleSubmitNewPassword} className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Verification confirmed. Set your new password for {resolvedEmail}.</span>
              </div>

              {passwordError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  New Password:
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters, letters and numbers"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-2xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40 font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  Confirm New Password:
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-2xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40 font-mono"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 rounded-2xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-400/15 transition-all cursor-pointer font-mono"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving New Password...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save New Password & Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: Success Screen */}
          {step === 'success' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white font-mono">
                  Password Successfully Reset!
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Your credentials have been securely updated. You can now log into FleetDiag AI with your new password.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                <span>Account: <strong className="text-amber-400">{resolvedEmail}</strong></span>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-400/15 transition-all cursor-pointer font-mono"
              >
                <span>Back to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
