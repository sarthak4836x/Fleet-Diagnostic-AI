import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  HelpCircle,
  Save,
  Sparkles,
} from 'lucide-react';
import { AuthUser } from '../types';
import {
  PRESET_SECURITY_QUESTIONS,
  saveUserSecurityQuestions,
  getUserSecurityQuestions,
} from '../utils/cryptoSecurity';

interface SecurityQuestionsSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onSaved?: () => void;
}

export const SecurityQuestionsSetupModal: React.FC<SecurityQuestionsSetupModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaved,
}) => {
  const [q1, setQ1] = useState(PRESET_SECURITY_QUESTIONS[0].text);
  const [a1, setA1] = useState('');
  const [showA1, setShowA1] = useState(false);

  const [q2, setQ2] = useState(PRESET_SECURITY_QUESTIONS[3].text);
  const [a2, setA2] = useState('');
  const [showA2, setShowA2] = useState(false);

  const [q3, setQ3] = useState(PRESET_SECURITY_QUESTIONS[5].text);
  const [a3, setA3] = useState('');
  const [showA3, setShowA3] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const loadCurrentQuestions = async () => {
      const existing = await getUserSecurityQuestions(currentUser.email);
      if (existing.found) {
        // A stored question that's no longer offered would leave its dropdown blank.
        const offered = PRESET_SECURITY_QUESTIONS.map((q) => q.text);
        if (offered.includes(existing.q1)) setQ1(existing.q1);
        if (offered.includes(existing.q2)) setQ2(existing.q2);
        if (offered.includes(existing.q3)) setQ3(existing.q3);
      }
    };
    loadCurrentQuestions();
  }, [isOpen, currentUser]);

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

  if (!isOpen || !currentUser) return null;
  if (typeof document === 'undefined') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!a1.trim() || !a2.trim() || !a3.trim()) {
      setErrorMessage('Please answer all 3 security questions.');
      return;
    }

    if (q1 === q2 || q2 === q3 || q1 === q3) {
      setErrorMessage('Please select 3 distinct questions.');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveUserSecurityQuestions(
        currentUser.email,
        q1,
        a1,
        q2,
        a2,
        q3,
        a3
      );
      setStatusMessage('Security questions saved.');
      onSaved?.();
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save security questions.');
    } finally {
      setIsSubmitting(false);
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
            <div className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                Setup 3 Security Recovery Questions
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Operator account: {currentUser.name} ({currentUser.email})
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

        {/* Form Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar-thin">
          {/* Zero-Plaintext Security Banner */}
          <div className="mb-5 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Zero-Plaintext Cryptographic Storage</div>
              <div className="text-[11px] text-slate-300/90 mt-0.5 leading-relaxed">
                Answers are sent over an encrypted connection and stored on the server only as salted <strong>scrypt</strong> hashes.
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Question 1 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="block text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                Security Question 1 (Depot & Logistics)
              </label>
              <select
                value={q1}
                onChange={(e) => setQ1(e.target.value)}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-400"
              >
                {PRESET_SECURITY_QUESTIONS.map((q) => (
                  <option key={q.id} value={q.text}>
                    {q.text}
                  </option>
                ))}
              </select>
              <div className="relative">
                <input
                  type={showA1 ? 'text' : 'password'}
                  value={a1}
                  onChange={(e) => setA1(e.target.value)}
                  placeholder="Enter your secret answer"
                  className="w-full py-2 pl-3 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowA1(!showA1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showA1 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Question 2 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="block text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                Security Question 2 (Operator Identity)
              </label>
              <select
                value={q2}
                onChange={(e) => setQ2(e.target.value)}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              >
                {PRESET_SECURITY_QUESTIONS.map((q) => (
                  <option key={q.id} value={q.text}>
                    {q.text}
                  </option>
                ))}
              </select>
              <div className="relative">
                <input
                  type={showA2 ? 'text' : 'password'}
                  value={a2}
                  onChange={(e) => setA2(e.target.value)}
                  placeholder="Enter your secret answer"
                  className="w-full py-2 pl-3 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowA2(!showA2)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showA2 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Question 3 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="block text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                Security Question 3 (Vehicle & Technical)
              </label>
              <select
                value={q3}
                onChange={(e) => setQ3(e.target.value)}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-400"
              >
                {PRESET_SECURITY_QUESTIONS.map((q) => (
                  <option key={q.id} value={q.text}>
                    {q.text}
                  </option>
                ))}
              </select>
              <div className="relative">
                <input
                  type={showA3 ? 'text' : 'password'}
                  value={a3}
                  onChange={(e) => setA3(e.target.value)}
                  placeholder="Enter your secret answer"
                  className="w-full py-2 pl-3 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowA3(!showA3)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showA3 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-amber-400/15 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save 3 Hashed Questions</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
