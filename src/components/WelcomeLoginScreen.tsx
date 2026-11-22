import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { AuthUser } from '../types';
import { authenticateUser } from '../data/authCredentials';
import { Logo } from './Logo';
import { PasswordResetModal } from './PasswordResetModal';

interface WelcomeLoginScreenProps {
  onLogin: (user: AuthUser) => void;
  /** Why the previous session ended, shown once above the form. */
  notice?: string;
}

export const WelcomeLoginScreen: React.FC<WelcomeLoginScreenProps> = ({ onLogin, notice }) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    const result = await authenticateUser(identifier, password);
    if (result.success) {
      setPassword('');
      onLogin(result.user);
    } else {
      setErrorMessage(result.error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[400px]">
          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-8">
            <Logo size="xl" />
            <h1 className="mt-5 text-[28px] sm:text-[32px] font-semibold tracking-tight text-white">
              FleetDiag AI
            </h1>
            <p className="mt-1.5 text-[15px] text-slate-400">
              Sign in to your fleet diagnostics workspace.
            </p>
          </div>

          {/* Card */}
          <div className="apple-card p-6 sm:p-7">
            {notice && !errorMessage && (
              <div
                role="status"
                className="mb-5 p-3 rounded-xl bg-amber-500/10 text-amber-300 text-[13px] flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}
            {errorMessage && (
              <div
                role="alert"
                className="mb-5 p-3 rounded-xl bg-rose-500/10 text-rose-400 text-[13px] flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="welcome-login-identifier" className="block text-[13px] font-medium text-slate-300 mb-1.5">
                  Email or username
                </label>
                <input
                  id="welcome-login-identifier"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="name@company.com"
                  className="apple-input"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="welcome-login-password" className="block text-[13px] font-medium text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    className="text-[13px] text-cyan-400 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="welcome-login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="Password"
                    className="apple-input pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-2 rounded-lg cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="welcome-login-submit-btn"
                type="submit"
                disabled={isSubmitting || !identifier.trim() || !password}
                className="apple-button-primary w-full mt-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-[12px] text-slate-500">
            Heavy-duty commercial vehicle telematics · BS-VI diagnostics
          </p>
        </div>
      </main>

      <PasswordResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialIdentifier={identifier}
        onSuccessLogin={(email) => {
          setIdentifier(email);
          setErrorMessage(null);
        }}
      />
    </div>
  );
};
