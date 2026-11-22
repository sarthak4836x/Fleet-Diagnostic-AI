import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, UserPlus, X } from 'lucide-react';
import { createOperatorAccount } from '../data/authCredentials';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { assignableRoles, RoleOption } from '../services/fleetView';
import type { UserRole } from '../types';

/** The password exists only here and is never shown again, so the parent stays open until "I've saved it". */
export const TemporaryPasswordNotice: React.FC<{ heading: string; password: string; onDone: () => void }> = ({
  heading,
  password,
  onDone,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-xs space-y-2">
      <div className="font-semibold text-amber-300">{heading}</div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="px-2 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm text-slate-100 break-all select-all">
          {password}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {copyFailed && <div role="alert" className="text-rose-300">Could not copy. Select the password and copy it by hand.</div>}
      <div className="text-amber-200">This password will not be shown again. They should change it after signing in.</div>
      <button
        type="button"
        onClick={onDone}
        className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold cursor-pointer"
      >
        I've saved it
      </button>
    </div>
  );
};

interface AddUserFormProps {
  /** Only a developer sends this. Without it the server uses the signed-in person's own fleet. */
  fleetId?: string;
  roles: RoleOption[];
  onCreated: (created: { email: string; temporaryPassword: string }) => void;
  onCancel?: () => void;
}

export const AddUserForm: React.FC<AddUserFormProps> = ({ fleetId, roles, onCreated, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(roles[0].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    const cleanEmail = email.trim();
    const result = await createOperatorAccount({ name: name.trim(), email: cleanEmail, role, fleetId });
    setSaving(false);
    if (result.success && result.temporaryPassword) {
      onCreated({ email: cleanEmail, temporaryPassword: result.temporaryPassword });
    } else {
      setError(result.error || 'Could not add this user.');
    }
  };

  const inputClass =
    'w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="add-user-name" className="block text-xs font-semibold text-slate-300 mb-1">Name</label>
          <input id="add-user-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="add-user-email" className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
          <input id="add-user-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="add-user-role" className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
        <select id="add-user-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputClass}>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold disabled:opacity-50 cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          {saving ? 'Adding…' : 'Add user'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorRole: UserRole;
  fleetName?: string;
}

/** Adds a person to the signed-in account's own fleet. */
export const AddStaffModal: React.FC<AddStaffModalProps> = ({ isOpen, onClose, creatorRole, fleetName }) => {
  // Held in component state only.
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen || created) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, created]);

  if (!isOpen) return null;

  return (
    <div
      onClick={() => {
        if (!created) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add staff"
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl text-slate-100 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">Add staff</h3>
            {fleetName && <p className="text-xs text-slate-400 truncate">{fleetName}</p>}
          </div>
          {!created && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {created ? (
            <TemporaryPasswordNotice
              heading={`Account created. Give this temporary password to ${created.email}.`}
              password={created.temporaryPassword}
              onDone={() => {
                setCreated(null);
                onClose();
              }}
            />
          ) : (
            <AddUserForm roles={assignableRoles(creatorRole)} onCreated={setCreated} onCancel={onClose} />
          )}
        </div>
      </div>
    </div>
  );
};
