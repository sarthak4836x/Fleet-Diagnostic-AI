import React, { useState, useRef, useEffect } from 'react';
import {
  Truck,
  UserPlus,
  Activity,
  Cpu,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Code,
  BookOpen,
  Gauge,
  MapPin,
  Navigation,
  Plus,
  Shield,
  MoreVertical,
  ChevronDown,
  Wrench,
  Radio,
  Sun,
  Moon,
  LogOut,
  User,
  Database,
  Mountain,
  Flame,
  Compass,
  RotateCw,
  Terminal,
  Scale,
  Layers,
  Bell,
  Info,
  X,
  Zap,
  Clock,
  Check,
  KeyRound,
  Building2,
} from 'lucide-react';
import { FleetVehicle, VehicleStatus, AuthUser, SimCondition } from '../types';
import { TelemetryAlert } from '../hooks/useTelemetryAlerts';
import { MiniMap } from './MiniMap';
import { useTheme } from '../context/ThemeContext';
import { LiveTrackingModal } from './LiveTrackingModal';
import { downloadSynopsisPDF } from '../utils/generateSynopsisPDF';
import { Logo } from './Logo';
import { SecurityQuestionsSetupModal } from './SecurityQuestionsSetupModal';
import { PasswordResetModal } from './PasswordResetModal';

interface HeaderProps {
  vehicles: FleetVehicle[];
  currentVehicleId: string;
  onSelectVehicle: (id: string) => void;
  status?: VehicleStatus;
  isDiagnosing: boolean;
  onRunDiagnostics: () => void;
  scanMode?: 'manual' | 'auto';
  onSelectScanMode?: (mode: 'manual' | 'auto') => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  simCondition?: SimCondition;
  onSelectSimCondition?: (condition: SimCondition) => void;
  gradePct?: number;
  onOpenWorkOrder: () => void;
  onOpenJsonView: () => void;
  onOpenTataManual?: () => void;
  onOpenSensorDefinitions?: () => void;
  isMiniMapOpen?: boolean;
  onToggleMiniMap?: () => void;
  onOpenAddVehicle: () => void;
  currentUser: AuthUser | null;
  alerts?: TelemetryAlert[];
  onOpenAlerts?: () => void;
  onOpenLoginModal: () => void;
  onLogout?: () => void;
  onOpenObdReader?: () => void;
  isDbConnected?: boolean;
  onOpenDeveloperConsole?: (tab?: any) => void;
  /** Opens the developer-only Fleets screen. */
  onOpenFleets?: () => void;
  onOpenAddStaff?: () => void;
  /** Only a developer inside a demo fleet may run the simulated telemetry stream. */
  canSimulate?: boolean;
  vehicleLoadKg?: number;
  onOpenLoadEmulator?: () => void;
  onOpenDynamicsHub?: (tab?: 'load' | 'profile' | 'telematics') => void;
}

export const Header: React.FC<HeaderProps> = ({
  vehicles,
  currentVehicleId,
  onSelectVehicle,
  status,
  isDiagnosing,
  onRunDiagnostics,
  scanMode = 'manual',
  onSelectScanMode,
  isSimulating,
  onToggleSimulation,
  simCondition = 'hill_climb',
  onSelectSimCondition,
  gradePct,
  onOpenWorkOrder,
  onOpenJsonView,
  onOpenTataManual,
  onOpenSensorDefinitions,
  isMiniMapOpen,
  onToggleMiniMap,
  onOpenAddVehicle,
  currentUser,
  alerts = [],
  onOpenAlerts,
  onOpenLoginModal,
  onLogout,
  onOpenObdReader,
  isDbConnected,
  onOpenDeveloperConsole,
  onOpenFleets,
  onOpenAddStaff,
  canSimulate = false,
  vehicleLoadKg = 40000,
  onOpenLoadEmulator,
  onOpenDynamicsHub,
}) => {
  const { theme, toggleTheme, isDaytime } = useTheme();
  const [internalMiniMapOpen, setInternalMiniMapOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [alertsDropdownOpen, setAlertsDropdownOpen] = useState(false);
  const [securityQuestionsModalOpen, setSecurityQuestionsModalOpen] = useState(false);
  const [hideQuestionsReminder, setHideQuestionsReminder] = useState(false);
  const [passwordResetModalOpen, setPasswordResetModalOpen] = useState(false);
  const [clearedAlerts, setClearedAlerts] = useState<Record<string, number>>({});
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());

  const SNOOZE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  useEffect(() => {
    const activeIds = new Set(alerts.map(a => a.id));
    setReadAlertIds(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const id of next) {
        if (!activeIds.has(id)) { next.delete(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [alerts]);

  const now = Date.now();
  const visibleAlerts = alerts.filter(a => {
    const clearedAt = clearedAlerts[a.id];
    if (clearedAt && (now - clearedAt < SNOOZE_DURATION_MS)) {
      return false; // Snoozed
    }
    return true;
  });

  const unreadCount = visibleAlerts.filter(a => !readAlertIds.has(a.id)).length;

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNow = Date.now();
    setClearedAlerts(prev => {
      const next = { ...prev };
      visibleAlerts.forEach(a => {
        next[a.id] = currentNow;
      });
      return next;
    });
  };

  const handleClearAlert = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setClearedAlerts(prev => ({ ...prev, [id]: Date.now() }));
  };

  const handleReadAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(readAlertIds);
    visibleAlerts.forEach(a => next.add(a.id));
    setReadAlertIds(next);
  };
  const toolsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest?.('[data-dropdown="alerts"]')) {
        setAlertsDropdownOpen(false);
      }
      if (!target.closest?.('[data-dropdown="tools"]')) {
        setToolsDropdownOpen(false);
      }
      if (!target.closest?.('[data-dropdown="user"]')) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentVehicle = vehicles.find((v) => v.vehicle_id === currentVehicleId) || vehicles[0];

  const miniMapActive = isMiniMapOpen !== undefined ? isMiniMapOpen : internalMiniMapOpen;
  const toggleMiniMap = onToggleMiniMap || (() => setInternalMiniMapOpen(!internalMiniMapOpen));

  const isLeadDeveloper =
    currentUser?.role === 'developer' ||
    Boolean(currentUser?.permissions?.includes('developer_console') && currentUser?.permissions?.includes('change_code'));

  const coords = currentVehicle?.coordinates;
  const latFormatted = coords
    ? `${Math.abs(coords.lat).toFixed(4)}°${coords.lat >= 0 ? 'N' : 'S'}`
    : '41.5834°N';
  const lngFormatted = coords
    ? `${Math.abs(coords.lng).toFixed(4)}°${coords.lng >= 0 ? 'E' : 'W'}`
    : '107.2345°W';

  const getStatusBadge = () => {
    switch (status) {
      case 'CRITICAL_STOP':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            CRITICAL STOP
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            ACTION ADVISORY
          </span>
        );
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <ShieldCheck className="w-3.5 h-3.5" />
            POWERTRAIN NOMINAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            READY
          </span>
        );
    }
  };

  // Reusable User Profile Dropdown Popover
  const renderUserDropdown = () => {
    if (!currentUser) return null;
    return (
      <div className="absolute right-0 mt-2 w-72 bg-slate-900/98 border border-slate-700 rounded-2xl shadow-2xl p-2.5 z-[110] text-xs animate-in fade-in zoom-in-95 backdrop-blur-md">
        <div className="p-2 border-b border-slate-800 mb-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full ${currentUser.avatarColor || 'bg-amber-500'} font-bold text-xs flex items-center justify-center shrink-0 shadow text-slate-950 ring-2 ring-slate-800`}>
              {(currentUser.name || 'User').split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-100 truncate text-sm">{currentUser.name}</div>
              <div className="text-[11px] text-amber-400 font-mono font-medium truncate">{currentUser.roleLabel || 'Operator'}</div>
              {currentUser.email && (
                <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
              )}
            </div>
          </div>
          {currentUser.badgeNumber && (
            <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Badge: #{currentUser.badgeNumber}</span>
              {currentUser.depot && <span className="text-slate-300">{currentUser.depot}</span>}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <button
            onClick={() => {
              setUserDropdownOpen(false);
              setSecurityQuestionsModalOpen(true);
            }}
            className="w-full px-2.5 py-2 rounded-xl text-left text-slate-200 hover:bg-slate-800/80 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset 3 Security Questions</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              scrypt
            </span>
          </button>

          <button
            onClick={() => {
              setUserDropdownOpen(false);
              setPasswordResetModalOpen(true);
            }}
            className="w-full px-2.5 py-2 rounded-xl text-left text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Change / Reset Password</span>
          </button>

          {onOpenAddStaff && (
            <button
              id="header-add-staff-btn"
              onClick={() => {
                setUserDropdownOpen(false);
                onOpenAddStaff();
              }}
              className="w-full px-2.5 py-2 rounded-xl text-left text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Staff</span>
            </button>
          )}

          <button
            onClick={() => {
              setUserDropdownOpen(false);
              onOpenLoginModal();
            }}
            className="w-full px-2.5 py-2 rounded-xl text-left text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Switch Operator</span>
          </button>
          {onLogout && (
            <button
              onClick={() => {
                setUserDropdownOpen(false);
                onLogout();
              }}
              className="w-full px-2.5 py-2 rounded-xl text-left text-rose-300 hover:text-white hover:bg-rose-500/20 flex items-center gap-2 transition-colors font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  // Reusable Alerts Dropdown Popover
  const renderAlertsDropdown = () => (
    <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-[110] animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 px-2 pt-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-slate-200">Active Alerts</h3>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
            {visibleAlerts.length} System
          </span>
        </div>
        {visibleAlerts.length > 0 && (
          <div className="flex items-center gap-3">
            <button onClick={handleReadAll} className="text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider cursor-pointer">Read All</button>
            <button onClick={handleClearAll} className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-wider cursor-pointer">Clear All</button>
          </div>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto custom-scrollbar-thin space-y-2 pr-1">
        {visibleAlerts.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-mono">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
            No active alerts
          </div>
        ) : (
          visibleAlerts.map(alert => (
            <div
              key={alert.id}
              className={`p-2.5 rounded-xl border transition-all ${readAlertIds.has(alert.id) ? 'opacity-50 grayscale-[50%]' : 'opacity-100 shadow-sm'} ${
                alert.type === 'critical' ? 'bg-rose-500/10 border-rose-500/30' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`shrink-0 p-1.5 rounded-lg ${alert.type === 'critical' ? 'bg-rose-600/30 text-rose-400' : alert.type === 'warning' ? 'bg-amber-600/30 text-amber-400' : 'bg-blue-600/30 text-blue-400'}`}>
                  {alert.type === 'critical' ? <ShieldAlert className="w-4 h-4" /> : alert.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`font-bold text-[11px] sm:text-xs uppercase tracking-wide ${alert.type === 'critical' ? 'text-rose-400' : alert.type === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>
                      {alert.title}
                    </h4>
                    <button onClick={(e) => handleClearAlert(e, alert.id)} title="Clear notification" className="p-1 -mr-1 -mt-1 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors shrink-0 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 font-mono mt-0.5 leading-snug">
                    {alert.message}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Reusable Workshop Tools Dropdown Popover
  const renderToolsDropdown = () => (
    <div className="absolute right-0 top-full mt-2 w-[240px] sm:w-80 max-w-[calc(100vw-1rem)] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-1.5 z-[110] text-xs animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto origin-top-right">
      <div className="px-3 py-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
        Workshop Reference Tools
      </div>

      <button
        onClick={() => {
          onOpenWorkOrder();
          setToolsDropdownOpen(false);
        }}
        className="w-full px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800/80 flex items-center gap-2 transition-colors cursor-pointer"
      >
        <FileText className="w-4 h-4 text-slate-400" />
        <span>Printable Work Order</span>
      </button>

      {onOpenTataManual && (
        <button
          onClick={() => {
            onOpenTataManual();
            setToolsDropdownOpen(false);
          }}
          className="w-full px-3 py-2 text-left text-blue-300 hover:text-white hover:bg-slate-800/80 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-blue-400" />
          <span>Tata BSVI DTC Manual</span>
        </button>
      )}

      {onOpenSensorDefinitions && (
        <button
          onClick={() => {
            onOpenSensorDefinitions();
            setToolsDropdownOpen(false);
          }}
          className="w-full px-3 py-2 text-left text-amber-300 hover:text-white hover:bg-slate-800/80 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Gauge className="w-4 h-4 text-amber-400" />
          <span>Sensor Threshold Specs</span>
        </button>
      )}

      <button
        onClick={() => {
          onOpenJsonView();
          setToolsDropdownOpen(false);
        }}
        className="w-full px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800/80 flex items-center gap-2 transition-colors border-t border-slate-800/80 cursor-pointer"
      >
        <Code className="w-4 h-4 text-amber-400" />
        <span>Raw Telemetry JSON</span>
      </button>

      {/* Project Synopsis PDF Download & View */}
      <button
        onClick={() => {
          setToolsDropdownOpen(false);
          downloadSynopsisPDF();
        }}
        className="w-full px-3 py-2 text-left text-cyan-300 hover:text-white hover:bg-cyan-950/40 flex items-center justify-between transition-colors border-t border-slate-800/80 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-medium">Project Synopsis (PDF)</span>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
          GENERATE & SAVE
        </span>
      </button>

      {/* Cloud Database Status Item */}
      <div className="px-3 py-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Cloud Storage</span>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
          {isDbConnected ? 'ONLINE' : 'TEMPORARY'}
        </span>
      </div>

      {/* Python Diagnostic Core Engine Item */}
      <div className="px-3 py-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Python Diagnostic Core</span>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
          PYTHON 3.10 ACTIVE
        </span>
      </div>

      {/* Theme Switcher in Tools dropdown */}
      <button
        id="dropdown-theme-toggle-btn"
        onClick={() => {
          toggleTheme();
          setToolsDropdownOpen(false);
        }}
        className="w-full px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800/80 flex items-center justify-between transition-colors border-t border-slate-800/80 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isDaytime ? <Sun className="w-4 h-4 text-amber-500 shrink-0" /> : <Moon className="w-4 h-4 text-amber-400 shrink-0" />}
          <span>{isDaytime ? 'Switch to Dark Appearance' : 'Switch to Light Appearance'}</span>
        </div>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xl bg-slate-800 text-slate-300 uppercase">
          {isDaytime ? 'Light' : 'Dark'}
        </span>
      </button>
    </div>
  );

  // Dedicated Scan Now Control: Used exclusively to fetch fault codes, health score, and predictive maintenance
  const renderScanControl = () => (
    <button
      id="run-diagnostics-btn"
      onClick={() => onRunDiagnostics()}
      disabled={isDiagnosing}
      title="Scan now: fetch fault codes, health score and maintenance forecast"
      className="apple-button-primary h-9 px-4 text-[13px] w-full whitespace-nowrap"
    >
      {isDiagnosing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>Scanning…</span>
        </>
      ) : (
        <>
          <Cpu className="w-3.5 h-3.5 shrink-0" />
          <span>Scan</span>
        </>
      )}
    </button>
  );

  // Sub-renderers for modularity and clean multi-viewport rendering
  const renderBrand = () => (
    <div className="flex items-center gap-2.5 shrink-0">
      <Logo size="sm" />
      <span className="text-[17px] font-semibold tracking-tight text-white">FleetDiag</span>
      {isDbConnected && (
        <span
          id="header-cloud-db-badge"
          title="Cloud database connected"
          className="w-2 h-2 rounded-full bg-emerald-400"
          aria-label="Cloud database connected"
        />
      )}
    </div>
  );

  const renderUnitSelector = (fullWidth = false) => (
    <div className={`flex items-center gap-1.5 min-w-0 ${fullWidth ? 'flex-1' : ''}`}>
      <div className={`relative min-w-0 ${fullWidth ? 'flex-1' : 'w-[240px] lg:w-[280px]'}`}>
        <Truck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          id="vehicle-selector-dropdown"
          aria-label="Select vehicle"
          value={currentVehicleId}
          onChange={(e) => onSelectVehicle(e.target.value)}
          className="w-full h-9 appearance-none bg-slate-800/70 hover:bg-slate-800 rounded-full pl-9 pr-8 text-[13px] font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 cursor-pointer truncate transition-colors"
        >
          {vehicles.map((v) => (
            <option key={v.vehicle_id} value={v.vehicle_id}>
              {v.unit_name} · {v.vehicle_id}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      <button
        id="header-add-vehicle-btn"
        onClick={onOpenAddVehicle}
        title="Add vehicle"
        aria-label="Add vehicle"
        className="apple-icon-button"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );

  const renderStreamToggle = () => {
    // Developer-only control
    if (!canSimulate) return null;
    return (
      <button
        id="toggle-simulation-btn"
        onClick={onToggleSimulation}
        title={isSimulating ? 'Pause live telemetry stream' : 'Start live telemetry stream'}
        aria-label={isSimulating ? 'Pause live telemetry stream' : 'Start live telemetry stream'}
        aria-pressed={isSimulating}
        className={`apple-icon-button ${isSimulating ? '!bg-cyan-500/15 !text-cyan-400' : ''}`}
      >
        <Radio className={`w-4 h-4 ${isSimulating ? 'animate-pulse' : ''}`} />
      </button>
    );
  };

  const renderToolsButton = () => (
    <div className="relative" data-dropdown="tools" ref={toolsRef}>
      <button
        id="header-tools-dropdown-btn"
        onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
        className="apple-icon-button"
        title="Tools"
        aria-label="Tools"
        aria-expanded={toolsDropdownOpen}
      >
        <Wrench className="w-4 h-4" />
      </button>
      {toolsDropdownOpen && renderToolsDropdown()}
    </div>
  );

  // Developer only: matches the server, where only role === 'developer' may call the fleet routes.
  const renderFleetsButton = () => {
    if (currentUser?.role !== 'developer' || !onOpenFleets) return null;
    return (
      <button
        id="header-fleets-btn"
        onClick={onOpenFleets}
        title={`Fleets (viewing ${currentUser.fleetName || 'a fleet'})`}
        aria-label={`Fleets, viewing ${currentUser.fleetName || 'a fleet'}`}
        className="apple-icon-button !w-auto gap-1.5 px-2.5 max-w-[9rem] sm:max-w-[12rem]"
      >
        <Building2 className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline truncate text-[13px] font-medium">{currentUser.fleetName}</span>
      </button>
    );
  };

  // Strictly restricted: ONLY visible to Lead Developer
  const renderDevConsoleButton = () => {
    if (!isLeadDeveloper || !onOpenDeveloperConsole) return null;
    return (
      <button
        id="header-lead-dev-console-btn"
        onClick={onOpenDeveloperConsole}
        title="Developer console"
        aria-label="Developer console"
        className="apple-icon-button"
      >
        <Terminal className="w-4 h-4" />
      </button>
    );
  };

  const renderAlertsButton = () => (
    <div className="relative" data-dropdown="alerts" ref={alertsRef}>
      <button
        id="header-notifications-bell-btn"
        onClick={() => setAlertsDropdownOpen(!alertsDropdownOpen)}
        className="apple-icon-button relative"
        title="Notifications"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[10px] font-semibold text-white flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      {alertsDropdownOpen && renderAlertsDropdown()}
    </div>
  );

  const renderUserProfile = () => {
    if (!currentUser) {
      if (!onOpenLoginModal) return null;
      return (
        <button
          id="header-login-btn"
          onClick={onOpenLoginModal}
          title="Sign In"
          className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-all shrink-0 cursor-pointer"
        >
          <User className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Sign In</span>
        </button>
      );
    }

    return (
      <div className="relative" data-dropdown="user" ref={userRef}>
        <button
          id="header-user-profile-btn"
          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
          title={`Operator: ${currentUser.name} (${currentUser.roleLabel || 'Operator'})`}
          className="flex items-center justify-center rounded-full shrink-0 cursor-pointer active:scale-95 transition-transform"
          aria-label="Account menu"
        >
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-b from-slate-500 to-slate-600 font-semibold text-[12px] text-white flex items-center justify-center shrink-0"
          >
            {(currentUser.name || 'User').split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
        </button>
        {userDropdownOpen && renderUserDropdown()}
      </div>
    );
  };

  return (
    <header className="apple-toolbar sticky top-0 z-50 w-full pt-[env(safe-area-inset-top)]">
      <div className="max-w-[1760px] mx-auto w-full px-4 lg:px-8">
        {/* Phone & tablet: two compact rows */}
        <div className="md:hidden flex flex-col gap-2.5 py-2.5 w-full">
          <div className="flex items-center justify-between gap-2 w-full">
            {renderBrand()}
            <div className="flex items-center gap-1 shrink-0">
              {renderStreamToggle()}
              {renderFleetsButton()}
              {renderDevConsoleButton()}
              {renderToolsButton()}
              {renderAlertsButton()}
              {renderUserProfile()}
            </div>
          </div>
          {/* The button in the row above has no room for the name below sm, so it gets its own line */}
          {currentUser?.role === 'developer' && onOpenFleets && currentUser.fleetName && (
            <p className="sm:hidden -mt-1 min-w-0 truncate text-[12px] text-slate-400">Viewing {currentUser.fleetName}</p>
          )}
          <div className="flex items-center gap-2 w-full">
            {renderUnitSelector(true)}
            <div className="shrink-0">{renderScanControl()}</div>
          </div>
        </div>

        {/* Desktop: single row */}
        <div className="hidden md:flex items-center justify-between gap-4 h-14 w-full">
          <div className="flex items-center gap-5 min-w-0">
            {renderBrand()}
            {renderUnitSelector()}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {renderStreamToggle()}
            {renderFleetsButton()}
            {renderDevConsoleButton()}
            {renderToolsButton()}
            {renderAlertsButton()}
            <div className="mx-1.5">{renderScanControl()}</div>
            {renderUserProfile()}
          </div>
        </div>
      </div>

      {currentUser?.hasSecurityQuestions === false && !hideQuestionsReminder && (
        <div className="border-t border-slate-800">
          <div className="max-w-[1760px] mx-auto w-full px-4 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-slate-300">
            <span>Set your security questions so you can reset your password if you forget it.</span>
            <span className="flex items-center gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setSecurityQuestionsModalOpen(true)}
                className="font-medium text-cyan-400 hover:underline cursor-pointer"
              >
                Set up now
              </button>
              <button
                type="button"
                onClick={() => setHideQuestionsReminder(true)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Later
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Fallback LiveTrackingModal if Header is used standalone without App.tsx parent state */}
      {!onToggleMiniMap && internalMiniMapOpen && currentVehicle && (
        <LiveTrackingModal
          isOpen={internalMiniMapOpen}
          onClose={() => setInternalMiniMapOpen(false)}
          vehicle={currentVehicle}
          allVehicles={vehicles}
          status={status}
          speedKmh={currentVehicle.telemetry.speed_kmh}
          onSelectVehicle={onSelectVehicle}
        />
      )}

      {/* Profile Security Recovery Modals */}
      <SecurityQuestionsSetupModal
        isOpen={securityQuestionsModalOpen}
        onClose={() => setSecurityQuestionsModalOpen(false)}
        currentUser={currentUser}
        onSaved={() => setHideQuestionsReminder(true)}
      />

      <PasswordResetModal
        isOpen={passwordResetModalOpen}
        onClose={() => setPasswordResetModalOpen(false)}
        initialIdentifier={currentUser?.email || ''}
      />
    </header>
  );
};
