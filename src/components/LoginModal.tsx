import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Lock,
  Shield,
  CheckCircle2,
  Wrench,
  Truck,
  Building2,
  X,
  LogOut,
  Sparkles,
  KeyRound,
  UserCheck,
  UserPlus,
  Clock,
  AlertCircle,
  Check,
  Ban,
  ArrowRight,
  ShieldAlert,
  Inbox,
  BadgeCheck,
  Terminal,
  Code,
} from 'lucide-react';
import { AuthUser, UserRole, SignupAccessRequest } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { Logo } from './Logo';
import { authenticateUser, createOperatorAccount, ROLE_CREDENTIALS } from '../data/authCredentials';
import { PasswordResetModal } from './PasswordResetModal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onLogin: (user: AuthUser) => void;
  onLogout: () => void;
  initialTab?: 'signin' | 'signup' | 'approvals' | 'reset';
}

export const PRESET_USERS: AuthUser[] = [
  {
    id: 'usr-dev-sarthak',
    name: 'Sarthak Gohil',
    email: 'developer@fleetdiag.local',
    role: 'developer',
    roleLabel: 'Lead Developer & Systems Architect',
    badgeNumber: 'DEV-LEAD-01',
    avatarColor: 'bg-cyan-500 text-slate-950 font-bold',
    shift: 'Core Telematics & Firmware Engineering Bay',
    depot: 'Tata Connected Vehicle Platform HQ (Bangalore & Pune Engineering Bay)',
    permissions: [
      'manage_all_fleets',
      'change_code',
      'override_telemetry',
      'manage_dtcs',
      'approve_access_requests',
      'dispatch_work_orders',
      'system_calibration',
      'developer_console',
      'obd_simulation_lab',
      'load_emulator',
    ],
  },
  {
    id: 'usr-fm-01',
    name: 'Marcus Vance',
    email: 'm.vance@fleetdiag-logistics.com',
    role: 'fleet_director',
    roleLabel: 'Fleet Owner',
    badgeNumber: 'DIR-4091',
    avatarColor: 'bg-amber-500 text-slate-950',
    shift: 'Operations & Fleet Command',
    depot: 'Interstate Freight Central Operations · Bay 1',
    permissions: [
      'manage_all_fleets',
      'fleet_director_access',
      'dispatch_work_orders',
      'approve_access_requests',
    ],
  },
  {
    id: 'usr-tech-02',
    name: 'Rajesh Sharma',
    email: 'r.sharma@workshop-certified.com',
    role: 'technician',
    roleLabel: 'Master Diagnostic Tech',
    badgeNumber: 'TECH-8821',
    avatarColor: 'bg-cyan-500 text-slate-950',
    shift: 'Bay 3 Workshop Lead',
    depot: 'Tata Motors & Cummins Diagnostics Hub',
  },
  {
    id: 'usr-disp-03',
    name: 'Sarah Chen',
    email: 's.chen@corridor-dispatch.com',
    role: 'dispatcher',
    roleLabel: 'Route & Fleet Dispatcher',
    badgeNumber: 'DISP-1102',
    avatarColor: 'bg-emerald-500 text-slate-950',
    shift: 'Interstate Night Corridor',
    depot: 'Logistics Terminal West',
  },
];

const INITIAL_REQUESTS: SignupAccessRequest[] = [
  {
    id: 'req-init-101',
    fullName: 'Anil Deshmukh',
    email: 'a.deshmukh@western-depot.com',
    requestedRole: 'technician',
    fleetCode: 'FLEET-HQ-2026',
    depotLocation: 'West Corridor Workshop · Bay 4',
    notes: 'Assigned to BS-VI heavy vehicle aftertreatment and SCR troubleshooting.',
    status: 'pending',
    requestedAt: 'Today at 08:30 AM',
  },
];

const VALID_FLEET_CODES = [
  { code: 'FLEET-HQ-2026', org: 'National Freight Logistics HQ' },
  { code: 'TATA-WEST-44', org: 'Tata Commercial Service Network' },
  { code: 'FREIGHT-NORTH-88', org: 'Northern Interstate Freight Express' },
];

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
  initialTab = 'signin',
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'approvals' | 'reset'>(initialTab);
  // The sample people belong to the Demo fleet; a customer must never see them
  const showSamples = currentUser?.isDemoFleet === true;
  const [signInMode, setSignInMode] = useState<'quick' | 'custom'>(showSamples ? 'quick' : 'custom');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedSwitchUser, setSelectedSwitchUser] = useState<AuthUser | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Sign In Form States
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInRole, setSignInRole] = useState<UserRole>('technician');
  const [signInError, setSignInError] = useState<string | null>(null);

  // Sign Up Form States
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpRole, setSignUpRole] = useState<UserRole>('technician');
  const [fleetCode, setFleetCode] = useState(showSamples ? 'FLEET-HQ-2026' : '');
  const [depotLocation, setDepotLocation] = useState('Central Regional Depot');
  const [signUpNotes, setSignUpNotes] = useState('');
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<SignupAccessRequest | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Pending Access Requests (persisted in localStorage)
  const [requests, setRequests] = useState<SignupAccessRequest[]>(() => {
    try {
      const saved = localStorage.getItem('fleetdiag_signup_requests');
      if (saved) {
        const parsed: SignupAccessRequest[] = JSON.parse(saved);
        return showSamples ? parsed : parsed.filter((r) => !INITIAL_REQUESTS.some((sample) => sample.id === r.id));
      }
    } catch {
      // fallback
    }
    return showSamples ? INITIAL_REQUESTS : [];
  });

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const saveRequests = (updated: SignupAccessRequest[]) => {
    setRequests(updated);
    try {
      localStorage.setItem('fleetdiag_signup_requests', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);

    const result = await authenticateUser(signInEmail, signInPassword);
    if (result.success) {
      setSelectedSwitchUser(null);
      onLogin(result.user);
      onClose();
    } else {
      setSignInError(result.error);
    }
  };

  const handleQuickSelect = (user: AuthUser) => {
    // Redirect to login form with the operator email pre-filled, requiring their password
    setActiveTab('signin');
    setSignInMode('custom');
    setSignInEmail(user.email);
    setSignInPassword('');
    setSignInRole(user.role);
    setSignInError(null);
    setSelectedSwitchUser(user);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 120);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError(null);

    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPassword.trim()) {
      setSignUpError('Please fill in all required account fields.');
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpError('Passwords do not match. Please re-enter.');
      return;
    }

    if (!fleetCode.trim()) {
      setSignUpError('A valid Fleet Organization Code is required for security verification.');
      return;
    }

    // Create new pending request for Director approval
    const newRequest: SignupAccessRequest = {
      id: `req-${Date.now()}`,
      fullName: signUpName.trim(),
      email: signUpEmail.trim().toLowerCase(),
      requestedRole: signUpRole,
      fleetCode: fleetCode.trim().toUpperCase(),
      depotLocation: depotLocation.trim() || 'Regional Depot',
      notes: signUpNotes.trim() || 'New technician/operator onboarding request.',
      status: 'pending',
      requestedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', Today',
    };

    const updated = [newRequest, ...requests];
    saveRequests(updated);
    setSubmittedRequest(newRequest);
  };

  // Director / Admin approves a candidate: the server creates the account and returns a
  // one-time temporary password for the approver to hand over. The approver is NOT logged in
  // as the new user (that used to be a privilege-escalation hole).
  const handleApprove = async (req: SignupAccessRequest) => {
    setApprovalNotice(null);
    const result = await createOperatorAccount({
      name: req.fullName,
      email: req.email,
      role: req.requestedRole,
      depot: `${req.depotLocation || 'Depot'} (${req.fleetCode})`,
    });
    if (!result.success) {
      setApprovalNotice({ kind: 'error', text: result.error || 'Could not create the account.' });
      return;
    }
    const updated = requests.map((r) =>
      r.id === req.id
        ? {
            ...r,
            status: 'approved' as const,
            reviewedBy: currentUser ? `${currentUser.name} (${currentUser.roleLabel})` : 'Reviewer',
            reviewedAt: 'Just now',
          }
        : r
    );
    saveRequests(updated);
    setApprovalNotice({
      kind: 'success',
      text: `Account created for ${req.email}. Share this one-time password securely: ${result.temporaryPassword}`,
    });
  };

  const handleReject = (reqId: string) => {
    const updated = requests.map((r) =>
      r.id === reqId
        ? {
            ...r,
            status: 'rejected' as const,
            reviewedBy: currentUser?.name || 'Fleet Owner',
            reviewedAt: 'Just now',
          }
        : r
    );
    saveRequests(updated);
  };

  const getRoleIcon = (r: UserRole) => {
    switch (r) {
      case 'developer':
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      case 'fleet_director':
      case 'fleet_manager':
        return <Building2 className="w-4 h-4 text-amber-400" />;
      case 'technician':
        return <Wrench className="w-4 h-4 text-cyan-400" />;
      case 'dispatcher':
        return <Truck className="w-4 h-4 text-emerald-400" />;
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto min-h-screen"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full max-w-[calc(100vw-20px)] min-w-0 overflow-hidden shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 bg-slate-950 min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Logo size="md" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white font-sans truncate">
                FleetDiag Access Portal
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-mono truncate">
                SAE J1939 Telemetry & Enterprise Fleet Authorization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Session Status if Logged In */}
        {currentUser && (
          <div className="p-3 sm:px-5 sm:py-3.5 bg-slate-950/70 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${currentUser.avatarColor || 'bg-amber-500'} font-bold text-xs flex items-center justify-center shadow shrink-0 ring-2 ring-slate-800`}>
                {(currentUser.name || 'User').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-100 truncate">{currentUser.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xl bg-slate-800 text-amber-400 border border-slate-700 font-semibold shrink-0">
                    {currentUser.badgeNumber}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="flex items-center gap-1 text-slate-300 font-medium shrink-0">
                    {getRoleIcon(currentUser.role)}
                    <span>{currentUser.roleLabel}</span>
                  </span>
                  <span className="text-slate-600 hidden xs:inline">•</span>
                  <span className="truncate text-slate-400 text-[11px] max-w-[180px] sm:max-w-[240px]">{currentUser.depot}</span>
                </div>
              </div>
            </div>

            <button
              id="modal-sign-out-btn"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-2xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-600/30 border border-rose-500/40 flex items-center justify-center gap-1.5 transition-all shrink-0 active:scale-95 touch-manipulation shadow-sm"
              title="End active operator session and sign out"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Primary Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-2 sm:px-4 text-xs font-mono overflow-x-auto scrollbar-none min-w-0 gap-1 sm:gap-2">
          <button
            onClick={() => {
              setActiveTab('signin');
              setSubmittedRequest(null);
            }}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 border-b-2 font-medium transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'signin'
                ? 'border-amber-400 text-amber-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>

          <button
            onClick={() => setActiveTab('signup')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 border-b-2 font-medium transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'signup'
                ? 'border-amber-400 text-amber-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign Up (Fleet Code)</span>
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 border-b-2 font-medium transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'approvals'
                ? 'border-amber-400 text-amber-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Fleet Owner Approvals</span>
            {pendingCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center font-mono">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: SIGN IN */}
        {activeTab === 'signin' && (
          <div className="p-5 space-y-4">
            {/* Toggle between Fast Demo Switch & Custom Login */}
            {showSamples && (
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setSignInMode('quick')}
                className={`flex-1 py-1.5 rounded-xl font-semibold transition-all ${
                  signInMode === 'quick'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fast Role Switch (Demo)
              </button>
              <button
                type="button"
                onClick={() => setSignInMode('custom')}
                className={`flex-1 py-1.5 rounded-xl font-semibold transition-all ${
                  signInMode === 'custom'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Custom Credentials
              </button>
            </div>
            )}

            {signInMode === 'quick' ? (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-400 font-mono">
                  Select an operator profile below to switch. You will be redirected to enter that operator's password to authenticate:
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {PRESET_USERS.map((user) => {
                    const isSelected = currentUser?.id === user.id;
                    return (
                      <button
                        key={user.id}
                        onClick={() => handleQuickSelect(user)}
                        className={`w-full p-3 rounded-3xl border text-left flex items-start justify-between transition-all group ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/60 shadow-sm'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-full ${user.avatarColor || 'bg-amber-500'} font-bold text-xs flex items-center justify-center shrink-0 shadow`}>
                            {(user.name || 'User').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-100 group-hover:text-white">
                                {user.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
                                {user.badgeNumber}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-amber-300/90 font-medium mt-0.5">
                              {getRoleIcon(user.role)}
                              <span>{user.roleLabel}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 font-mono">
                              {user.depot}
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Active Session
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 rounded-xl group-hover:bg-amber-400 group-hover:text-slate-950 transition-all font-semibold">
                            Enter Password →
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCustomLogin} className="space-y-3.5">
                {selectedSwitchUser && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs font-mono text-amber-300">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full ${selectedSwitchUser.avatarColor || 'bg-amber-500'} font-bold text-xs flex items-center justify-center shrink-0 shadow text-slate-950`}>
                        {(selectedSwitchUser.name || 'User').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          <span>Switch Operator: {selectedSwitchUser.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-amber-400 border border-slate-700">
                            {selectedSwitchUser.badgeNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate font-mono">{selectedSwitchUser.email}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSwitchUser(null);
                        setSignInMode('quick');
                      }}
                      className="text-xs text-amber-400 hover:text-white underline shrink-0 cursor-pointer font-sans"
                    >
                      Change
                    </button>
                  </div>
                )}

                {signInError && (
                  <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                    {signInError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="technician@fleet-logistics.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Password *
                  </label>
                  <input
                    ref={passwordInputRef}
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex justify-between items-center pt-1 text-[11px] font-mono text-slate-400">
                    <span>
                      {selectedSwitchUser ? `Enter password for ${selectedSwitchUser.name}` : 'Default passwords in documentation'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsResetModalOpen(true)}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Forgot?</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Role Clearance
                  </label>
                  <select
                    value={signInRole}
                    onChange={(e) => setSignInRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="developer">Lead Developer & Systems Architect (Core Telematics & Dev Console)</option>
                    <option value="fleet_director">Fleet Owner (Operations & Fleet Command)</option>
                    <option value="fleet_manager">Fleet Operations Manager</option>
                    <option value="technician">Diagnostic Technician (Workshop & DTC Resets)</option>
                    <option value="dispatcher">Route Dispatcher (Fleet Tracking & GPS)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{selectedSwitchUser ? `Sign In as ${selectedSwitchUser.name}` : 'Authorize Session'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: SIGN UP WITH FLEET SPECIFIC CODE & DIRECTOR APPROVAL */}
        {activeTab === 'signup' && (
          <div className="p-5">
            {submittedRequest ? (
              <div className="p-6 text-center space-y-4 bg-slate-950/80 rounded-3xl border border-amber-500/30 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                  <Clock className="w-6 h-6 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-100">
                    Access Request Submitted for Approval
                  </h4>
                  <p className="text-xs text-amber-300/90 font-mono">
                    Routing to your Fleet Owner
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3.5 text-xs text-left font-mono space-y-1.5 text-slate-300">
                  <div className="flex justify-between text-slate-400">
                    <span>Applicant:</span>
                    <span className="text-slate-100 font-bold">{submittedRequest.fullName}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Work Email:</span>
                    <span className="text-slate-200">{submittedRequest.email}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Fleet Organization Code:</span>
                    <span className="text-amber-400 font-bold">{submittedRequest.fleetCode}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Requested Role:</span>
                    <span className="capitalize text-slate-200">{submittedRequest.requestedRole}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Depot Location:</span>
                    <span className="text-slate-200">{submittedRequest.depotLocation}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                    <span>Status:</span>
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending Fleet Owner Review
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Your request has been placed in the Fleet Owner approval queue. You can switch to the{' '}
                  <strong className="text-amber-300">"Fleet Owner Approvals"</strong> tab now to test or grant immediate clearance.
                </p>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setActiveTab('approvals')}
                    className="flex-1 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>Go to Approvals Queue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setSubmittedRequest(null)}
                    className="py-2 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                  >
                    Back to Form
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-3xl p-3 text-xs text-amber-300/90 font-sans leading-relaxed">
                  <Building2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-200 block font-semibold mb-0.5">Enterprise Fleet Security:</strong>
                    New accounts require your organization's assigned fleet code. Requests are routed to the Fleet Owner or Workshop Administrator for identity approval.
                  </div>
                </div>

                {signUpError && (
                  <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                    {signUpError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="e.g. Vikram Joshi"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="v.joshi@fleet-depot.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Fleet Specific Code Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Fleet Specific Code *</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Provided by Fleet Owner / Admin</span>
                  </div>

                  <input
                    type="text"
                    required
                    value={fleetCode}
                    onChange={(e) => setFleetCode(e.target.value)}
                    placeholder={showSamples ? 'e.g. FLEET-HQ-2026' : 'Your fleet code'}
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-2xl px-3 py-2 text-xs font-mono font-bold text-amber-300 tracking-wider focus:outline-none focus:border-amber-400"
                  />

                  {/* Valid preset chips */}
                  {showSamples && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">Quick Codes:</span>
                    {VALID_FLEET_CODES.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setFleetCode(item.code)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-xl border transition-colors ${
                          fleetCode === item.code
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {item.code}
                      </button>
                    ))}
                  </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Requested Role *
                    </label>
                    <select
                      value={signUpRole}
                      onChange={(e) => setSignUpRole(e.target.value as UserRole)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      <option value="developer">Lead Developer & Systems Architect (Core Dev Access)</option>
                      <option value="fleet_director">Fleet Owner (Operations Command)</option>
                      <option value="fleet_manager">Depot Operations Manager</option>
                      <option value="technician">Diagnostic Technician (Workshop Floor)</option>
                      <option value="dispatcher">Route Dispatcher (Tracking & Corridor)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Depot / Bay Location
                    </label>
                    <input
                      type="text"
                      value={depotLocation}
                      onChange={(e) => setDepotLocation(e.target.value)}
                      placeholder="e.g. Mumbai-Pune Express Bay 2"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Create Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Access Reason / Workshop Shift Details
                  </label>
                  <textarea
                    rows={2}
                    value={signUpNotes}
                    onChange={(e) => setSignUpNotes(e.target.value)}
                    placeholder="e.g. Commercial vehicle technician for BS-VI fleet maintenance and DTC triage..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Submit Access Request to Fleet Owner</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 3: DIRECTOR & ADMIN APPROVALS QUEUE */}
        {activeTab === 'approvals' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  Fleet Owner Approval Center
                </h4>
                <p className="text-xs text-slate-400">
                  Review incoming onboarding requests with fleet organizational codes:
                </p>
              </div>

              <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-slate-950 text-amber-400 border border-slate-800">
                {pendingCount} Pending
              </span>
            </div>

            {approvalNotice && (
              <div
                role="status"
                className={`p-3 rounded-2xl text-xs leading-relaxed break-words select-all ${
                  approvalNotice.kind === 'success'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                }`}
              >
                {approvalNotice.text}
              </div>
            )}

            {requests.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-3xl border border-slate-800 text-slate-400 text-xs">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                No access requests currently logged.
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-3xl border transition-all ${
                      req.status === 'pending'
                        ? 'bg-slate-950 border-amber-500/40 shadow-sm'
                        : req.status === 'approved'
                        ? 'bg-slate-950/50 border-emerald-500/30'
                        : 'bg-slate-950/30 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-100">{req.fullName}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                            Code: {req.fleetCode}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {req.email} • {req.depotLocation}
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-300 font-medium">
                          {getRoleIcon(req.requestedRole)}
                          <span className="capitalize">{req.requestedRole} role requested</span>
                          <span className="text-slate-500 font-mono text-[11px]">• {req.requestedAt}</span>
                        </div>

                        {req.notes && (
                          <p className="text-[11px] text-slate-400 mt-1.5 bg-slate-900/90 rounded-2xl p-2 border border-slate-800/80 leading-relaxed font-sans">
                            "{req.notes}"
                          </p>
                        )}
                      </div>

                      {/* Status & Actions */}
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        {req.status === 'pending' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleApprove(req)}
                              className="px-2.5 py-1 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1 transition-all shadow active:scale-95"
                              title="Approve request and authorize session"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>

                            <button
                              onClick={() => handleReject(req.id)}
                              className="px-2 py-1 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium border border-rose-500/30 transition-colors"
                              title="Decline request"
                            >
                              <Ban className="w-3 h-3" />
                            </button>
                          </div>
                        ) : req.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-xl border border-emerald-500/30 font-bold">
                            <BadgeCheck className="w-3.5 h-3.5" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-xl border border-rose-500/30">
                            Declined
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Password Recovery Modal */}
        <PasswordResetModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          initialIdentifier={signInEmail}
          onSuccessLogin={(email) => {
            setSignInEmail(email);
            setSignInError(null);
            setActiveTab('signin');
          }}
        />
      </div>
    </div>
  );
};
