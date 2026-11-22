import React, { useState, useEffect, useCallback } from 'react';
import { Building2, X, AlertTriangle, Plus, UserPlus } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { assignableRoles } from '../services/fleetView';
import { AddUserForm, TemporaryPasswordNotice } from './AddUserForm';
import {
  FleetSummary,
  listFleets,
  createFleetWithOwner,
  updateFleetStatus,
  switchActiveFleet,
} from '../services/fleetApi';

interface FleetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFleetId?: string;
}

export const FleetsModal: React.FC<FleetsModalProps> = ({ isOpen, onClose, activeFleetId }) => {
  const [fleets, setFleets] = useState<FleetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmSuspendId, setConfirmSuspendId] = useState<string | null>(null);
  const [addUserFleetId, setAddUserFleetId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [creating, setCreating] = useState(false);
  // Held in component state only. While it is set the screen shows nothing else and can't be dismissed by accident.
  const [created, setCreated] = useState<{ heading: string; password: string } | null>(null);

  useBodyScrollLock(isOpen);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setFleets(await listFleets());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load fleets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCreated(null);
      setError(null);
      setConfirmSuspendId(null);
      setAddUserFleetId(null);
      setName('');
      setOwnerName('');
      setOwnerEmail('');
      return;
    }
    refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen || created) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, created]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const result = await createFleetWithOwner({
        name: name.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
      });
      setCreated({
        heading: `Fleet "${result.fleet.name}" created. Give this temporary password to ${ownerEmail.trim()}.`,
        password: result.temporaryPassword,
      });
      setName('');
      setOwnerName('');
      setOwnerEmail('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the fleet.');
    } finally {
      setCreating(false);
    }
  };

  const handleUserCreated = (fleet: FleetSummary, user: { email: string; temporaryPassword: string }) => {
    setCreated({
      heading: `${user.email} added to ${fleet.name}. Give them this temporary password.`,
      password: user.temporaryPassword,
    });
    setAddUserFleetId(null);
    void refresh();
  };

  const handleStatus = async (fleet: FleetSummary, status: 'active' | 'suspended') => {
    setBusyId(fleet.id);
    setError(null);
    setConfirmSuspendId(null);
    try {
      await updateFleetStatus(fleet.id, status);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the fleet.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSwitch = async (fleet: FleetSummary) => {
    setBusyId(fleet.id);
    setError(null);
    try {
      await switchActiveFleet(fleet.id);
      // A full reload also stops any running simulator and drops all per-fleet state.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch fleets.');
      setBusyId(null);
    }
  };

  const inputClass =
    'w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400';

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
        aria-label="Fleets"
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl text-slate-100 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-3xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white">Fleets</h3>
              <p className="text-xs text-slate-400">Customer fleets and the one you are viewing</p>
            </div>
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

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          {created ? (
            <TemporaryPasswordNotice heading={created.heading} password={created.password} onDone={() => setCreated(null)} />
          ) : (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">All fleets</h4>
                {loading && fleets.length === 0 ? (
                  <div className="text-xs text-slate-400">Loading fleets…</div>
                ) : (
                  <ul className="space-y-2">
                    {fleets.map((fleet) => {
                      const isActive = fleet.id === activeFleetId;
                      const busy = busyId === fleet.id;
                      return (
                        <li
                          key={fleet.id}
                          className={`p-3 rounded-2xl border ${isActive ? 'border-amber-400/50 bg-amber-400/5' : 'border-slate-800 bg-slate-950'}`}
                        >
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-semibold text-sm text-white break-words min-w-0">{fleet.name}</span>
                            {fleet.isDemo && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">Demo</span>
                            )}
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                fleet.status === 'active'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {fleet.status === 'active' ? 'Active' : 'Suspended'}
                            </span>
                            {isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                Viewing now
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {fleet.vehicleCount} {fleet.vehicleCount === 1 ? 'vehicle' : 'vehicles'} · {fleet.userCount}{' '}
                            {fleet.userCount === 1 ? 'user' : 'users'}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {!isActive && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleSwitch(fleet)}
                                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                              >
                                Switch to this fleet
                              </button>
                            )}
                            {!fleet.isDemo && fleet.status === 'active' && confirmSuspendId !== fleet.id && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirmSuspendId(fleet.id)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-300 text-xs font-medium disabled:opacity-50 cursor-pointer"
                              >
                                Suspend
                              </button>
                            )}
                            {!fleet.isDemo && fleet.status === 'active' && confirmSuspendId === fleet.id && (
                              <span className="flex flex-wrap items-center gap-2 text-xs text-rose-300">
                                <span>Suspend {fleet.name}? Its users will lose access.</span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleStatus(fleet, 'suspended')}
                                  className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold disabled:opacity-50 cursor-pointer"
                                >
                                  Confirm suspend
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmSuspendId(null)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </span>
                            )}
                            {!fleet.isDemo && fleet.status === 'suspended' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleStatus(fleet, 'active')}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-medium disabled:opacity-50 cursor-pointer"
                              >
                                Reactivate
                              </button>
                            )}
                            {addUserFleetId !== fleet.id && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setAddUserFleetId(fleet.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium disabled:opacity-50 cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                Add user
                              </button>
                            )}
                          </div>
                          {addUserFleetId === fleet.id && (
                            <div className="mt-3 pt-3 border-t border-slate-800">
                              <AddUserForm
                                fleetId={fleet.id}
                                roles={assignableRoles('developer')}
                                onCreated={(user) => handleUserCreated(fleet, user)}
                                onCancel={() => setAddUserFleetId(null)}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <form onSubmit={handleCreate} className="space-y-3 border-t border-slate-800 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Add a customer fleet</h4>
                <div>
                  <label htmlFor="fleet-name" className="block text-xs font-semibold text-slate-300 mb-1">Fleet name</label>
                  <input id="fleet-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fleet-owner-name" className="block text-xs font-semibold text-slate-300 mb-1">Owner name</label>
                    <input id="fleet-owner-name" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="fleet-owner-email" className="block text-xs font-semibold text-slate-300 mb-1">Owner email</label>
                    <input id="fleet-owner-email" type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {creating ? 'Creating…' : 'Create fleet'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
