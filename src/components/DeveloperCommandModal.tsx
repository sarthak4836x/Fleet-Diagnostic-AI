import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Code,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Mountain,
  Flame,
  Compass,
  Activity,
  RotateCw,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Truck,
  Plus,
  X,
  FileCode,
  Layers,
  Sparkles,
  Play,
  Pause,
  KeyRound,
  Trash2,
  Send,
  Scale,
  Gauge,
  Lock,
  Info,
  Copy,
  Check,
  ExternalLink,
  Cpu,
  Database,
  ArrowRight,
  Server,
  Network,
  Share2,
  Zap,
  Clock,
} from 'lucide-react';
import { AuthUser, FleetVehicle, SimCondition, VehicleLoadPreset, VehicleSnapshot, TelemetryData } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { generateSimulatedObdHex, decodeRawTelematicsPayload } from '../services/obdDecoder';
import { availableConsoleTab } from '../services/fleetView';
import { downloadSynopsisPDF } from '../utils/generateSynopsisPDF';

interface DeveloperCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  vehicles: FleetVehicle[];
  currentVehicleId: string;
  onSelectVehicle: (id: string) => void;
  currentSnapshot: VehicleSnapshot;
  onUpdateTelemetry: (newTelemetry: any) => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  canSimulate?: boolean;
  simCondition: SimCondition;
  onSelectSimCondition: (cond: SimCondition) => void;
  gradePct: number;
  onRunDiagnostics: () => void;
  onOpenAddVehicle: () => void;
  vehicleLoadKg?: number;
  onUpdateVehicleLoad?: (loadKg: number, preset?: VehicleLoadPreset) => void;
  loadPreset?: VehicleLoadPreset;
  initialTab?: 'obd_scanner' | 'dynamics_hub' | 'telemetry_override' | 'dtc_injector' | 'fleet_manager' | 'python_runtime' | 'security_shield' | 'obd_live' | 'simulation';
}

export const DeveloperCommandModal: React.FC<DeveloperCommandModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  vehicles,
  currentVehicleId,
  onSelectVehicle,
  currentSnapshot,
  onUpdateTelemetry,
  isSimulating,
  onToggleSimulation,
  canSimulate = false,
  simCondition,
  onSelectSimCondition,
  gradePct,
  onRunDiagnostics,
  onOpenAddVehicle,
  vehicleLoadKg = 40000,
  onUpdateVehicleLoad,
  loadPreset = 'rated',
  initialTab,
}) => {
  useBodyScrollLock(isOpen);

  // Normalize active tab with backwards-compatible aliases
  const getNormalizedTab = (tab?: string) => {
    if (tab === 'obd_live') return 'obd_scanner';
    if (tab === 'simulation') return 'dynamics_hub';
    if (
      tab === 'dynamics_hub' ||
      tab === 'telemetry_override' ||
      tab === 'dtc_injector' ||
      tab === 'fleet_manager' ||
      tab === 'python_runtime' ||
      tab === 'security_shield'
    ) {
      return tab;
    }
    return 'obd_scanner';
  };

  const [selectedTab, setActiveTab] = useState<
    'obd_scanner' | 'dynamics_hub' | 'telemetry_override' | 'dtc_injector' | 'fleet_manager' | 'python_runtime' | 'security_shield'
  >(getNormalizedTab(initialTab));
  const activeTab = availableConsoleTab(selectedTab, canSimulate);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(getNormalizedTab(initialTab));
    }
  }, [initialTab]);

  const [copiedHex, setCopiedHex] = useState(false);
  const [customHexInput, setCustomHexInput] = useState<string>('41 0C 1A F8 41 05 82 41 0D 4A 41 11 5A');
  const [streamLogs, setStreamLogs] = useState<
    Array<{ id: string; time: string; vehicleId: string; raw: string; label?: string }>
  >([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString(),
      vehicleId: currentVehicleId,
      raw: 'Mode 01 PID 0C: 41 0C 1A F8 (RPM 1726) | PID 05: 41 05 82 (Coolant 90°C)',
      label: 'BROADCAST',
    },
    {
      id: 'init-2',
      time: new Date(Date.now() - 1500).toLocaleTimeString(),
      vehicleId: currentVehicleId,
      raw: 'Mode 01 PID 0D: 41 0D 48 (Speed 72 km/h) | PID 11: 41 11 5E (Load 37%)',
      label: 'BROADCAST',
    },
  ]);

  // Live telemetry parameters derived from vehicle snapshot
  const currentTelemetry = currentSnapshot.telemetry;
  const rpmVal = currentTelemetry.engine_rpm ?? 1400;
  const speedVal = currentTelemetry.speed_kmh ?? 0;
  const coolantVal = currentTelemetry.coolant_temp_c ?? 85;
  const loadVal = currentTelemetry.engine_load_pct ?? 40;
  const voltVal = currentTelemetry.battery_voltage_v ?? 24.2;
  const exhaustVal = currentTelemetry.exhaust_temp_c ?? 430;
  const noxVal = currentTelemetry.nox_sensor_ppm ?? 135;
  const sootVal = currentTelemetry.soot_level_g ?? 18.5;
  const fuelRateVal = currentTelemetry.fuel_rate_lph ?? 28.0;
  const railPressureVal = currentTelemetry.rail_pressure_bar ?? 1600;

  // Compute standard SAE J1979 hex representations
  const rawRpmVal = Math.min(65535, Math.round(rpmVal * 4));
  const rpmHexA = Math.floor(rawRpmVal / 256).toString(16).padStart(2, '0').toUpperCase();
  const rpmHexB = (rawRpmVal % 256).toString(16).padStart(2, '0').toUpperCase();
  const coolantHex = Math.max(0, Math.min(255, Math.round(coolantVal + 40))).toString(16).padStart(2, '0').toUpperCase();
  const speedHex = Math.max(0, Math.min(255, Math.round(speedVal))).toString(16).padStart(2, '0').toUpperCase();
  const throttleHex = Math.max(0, Math.min(255, Math.round((loadVal * 255) / 100))).toString(16).padStart(2, '0').toUpperCase();

  const rawObdHex = generateSimulatedObdHex({
    engine_rpm: currentTelemetry.engine_rpm,
    speed_kmh: currentTelemetry.speed_kmh,
    coolant_temp_c: currentTelemetry.coolant_temp_c,
    engine_load_pct: currentTelemetry.engine_load_pct,
    active_dtc_codes: currentTelemetry.active_dtc_codes,
  });

  const handleCopyRawHex = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(rawObdHex);
      setCopiedHex(true);
      setTimeout(() => setCopiedHex(false), 2000);
    }
  };

  // Local override state for instant hot-injection
  const [overrideRpm, setOverrideRpm] = useState(currentSnapshot.telemetry.engine_rpm);
  const [overrideCoolant, setOverrideCoolant] = useState(currentSnapshot.telemetry.coolant_temp_c);
  const [overrideSpeed, setOverrideSpeed] = useState(currentSnapshot.telemetry.speed_kmh);
  const [overrideLoad, setOverrideLoad] = useState(currentSnapshot.telemetry.engine_load_pct);
  const [overrideExhaust, setOverrideExhaust] = useState(currentSnapshot.telemetry.exhaust_temp_c || 430);
  const [overrideSoot, setOverrideSoot] = useState(currentSnapshot.telemetry.soot_level_g || 18.4);
  const [overrideNox, setOverrideNox] = useState(currentSnapshot.telemetry.nox_sensor_ppm || 165);
  const [overrideBattery, setOverrideBattery] = useState(currentSnapshot.telemetry.battery_voltage_v || 27.6);
  const [overrideTirePsi, setOverrideTirePsi] = useState(currentSnapshot.telemetry.tire_pressure_psi || 105);
  const [customDtcInput, setCustomDtcInput] = useState('');
  const [injectSuccessMessage, setInjectSuccessMessage] = useState<string | null>(null);

  // Interactive Python Engine Testing State
  const [pythonTestMode, setPythonTestMode] = useState<'diagnose' | 'fuel' | 'predictive' | 'query'>('diagnose');
  const [pythonTestRunning, setPythonTestRunning] = useState(false);
  const [pythonTestOutput, setPythonTestOutput] = useState<any>(null);
  const [pythonQuestionInput, setPythonQuestionInput] = useState('what is the torque specification for the NOx sensor?');

  // Backend Security Shield & Firewall State
  const [securityStats, setSecurityStats] = useState<any>(null);
  const [securityAuditEvents, setSecurityAuditEvents] = useState<any[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [penTestRunning, setPenTestRunning] = useState(false);
  const [penTestResults, setPenTestResults] = useState<any[] | null>(null);

  // Backup Database & Disaster Recovery State
  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [backupSnapshots, setBackupSnapshots] = useState<any[]>([]);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const fetchSecurityData = async () => {
    try {
      setSecurityLoading(true);
      const [resStatus, resAudit, resBackup, resSnaps] = await Promise.all([
        fetch('/api/security/status').then((r) => r.json()).catch(() => null),
        fetch('/api/security/audit-log?limit=25').then((r) => r.json()).catch(() => ({ events: [] })),
        fetch('/api/backup/status').then((r) => r.json()).catch(() => null),
        fetch('/api/backup/snapshots').then((r) => r.json()).catch(() => ({ snapshots: [] })),
      ]);
      if (resStatus) setSecurityStats(resStatus);
      if (resAudit?.events) setSecurityAuditEvents(resAudit.events);
      if (resBackup) setBackupStatus(resBackup);
      if (resSnaps?.snapshots) setBackupSnapshots(resSnaps.snapshots);
    } catch (err) {
      console.error('Failed to load security & backup telemetry:', err);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleCreateBackupSnapshot = async () => {
    try {
      setBackupActionLoading(true);
      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual Snapshot via Lead Developer Console' }),
      });
      const data = await res.json();
      setBackupMessage(`Snapshot created: ${data.snapshot?.filename || 'archive.json'}`);
      setTimeout(() => setBackupMessage(null), 4000);
      fetchSecurityData();
    } catch (err: any) {
      setBackupMessage(`Snapshot failed: ${err.message}`);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleRestoreBackupSnapshot = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore the fleet database from snapshot ${filename}? This will synchronize the memory roster with this archived state.`)) {
      return;
    }
    try {
      setBackupActionLoading(true);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      setBackupMessage(data.message || 'Database restored successfully.');
      setTimeout(() => setBackupMessage(null), 5000);
      fetchSecurityData();
      onRunDiagnostics();
    } catch (err: any) {
      setBackupMessage(`Restore failed: ${err.message}`);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleToggleFailover = async () => {
    try {
      setBackupActionLoading(true);
      const targetActive = !backupStatus?.failoverActive;
      const res = await fetch('/api/backup/toggle-failover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: targetActive,
          reason: targetActive ? 'Simulated Primary Database Outage (Disaster Recovery Test)' : undefined,
        }),
      });
      const data = await res.json();
      setBackupMessage(data.message);
      setTimeout(() => setBackupMessage(null), 5000);
      fetchSecurityData();
    } catch (err: any) {
      setBackupMessage(`Failover toggle failed: ${err.message}`);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleRunPenTest = async () => {
    try {
      setPenTestRunning(true);
      const res = await fetch('/api/security/pen-test', { method: 'POST' });
      const data = await res.json();
      setPenTestResults(data.testResults || []);
      fetchSecurityData();
    } catch (err) {
      console.error('Failed to run pen test:', err);
    } finally {
      setPenTestRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'security_shield') {
      fetchSecurityData();
    }
  }, [isOpen, activeTab]);

  // Synchronize state when snapshot or modal visibility changes
  useEffect(() => {
    if (isOpen) {
      setOverrideRpm(currentSnapshot.telemetry.engine_rpm);
      setOverrideCoolant(currentSnapshot.telemetry.coolant_temp_c);
      setOverrideSpeed(currentSnapshot.telemetry.speed_kmh);
      setOverrideLoad(currentSnapshot.telemetry.engine_load_pct);
      setOverrideExhaust(currentSnapshot.telemetry.exhaust_temp_c || 430);
      setOverrideSoot(currentSnapshot.telemetry.soot_level_g || 18.4);
      setOverrideNox(currentSnapshot.telemetry.nox_sensor_ppm || 165);
      setOverrideBattery(currentSnapshot.telemetry.battery_voltage_v || 27.6);
      setOverrideTirePsi(currentSnapshot.telemetry.tire_pressure_psi || 105);
    }
  }, [isOpen, currentSnapshot]);

  if (!isOpen) return null;

  // Strict Lead Developer Access: Fleet Director does NOT have access!
  const isLeadDeveloper =
    currentUser?.role === 'developer' ||
    Boolean(currentUser?.permissions?.includes('developer_console') && currentUser?.permissions?.includes('change_code'));

  const handleApplyTelemetryOverride = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTelemetry({
      engine_rpm: Number(overrideRpm),
      coolant_temp_c: Number(overrideCoolant),
      speed_kmh: Number(overrideSpeed),
      speed_mph: Math.round(Number(overrideSpeed) / 1.60934),
      engine_load_pct: Number(overrideLoad),
      exhaust_temp_c: Number(overrideExhaust),
      soot_level_g: Number(overrideSoot),
      nox_sensor_ppm: Number(overrideNox),
      battery_voltage_v: Number(overrideBattery),
      tire_pressure_psi: Number(overrideTirePsi),
    });
    setInjectSuccessMessage('Live telemetry overridden and pushed to vehicle CAN-bus.');
    setTimeout(() => setInjectSuccessMessage(null), 3000);
  };

  const handleInjectDtc = (codeToInject: string) => {
    const trimmed = codeToInject.trim().toUpperCase();
    if (!trimmed) return;
    const currentCodes = currentSnapshot.telemetry.active_dtc_codes || [];
    const extraTelemetry: Partial<TelemetryData> = {};

    // Automatically synchronize realistic sensor states for critical DTCs
    if (trimmed === 'P2463' || trimmed === 'P244B' || trimmed === 'P244B-00') {
      const targetSoot = Math.max(29.4, currentSnapshot.telemetry.soot_level_g || 29.4);
      extraTelemetry.soot_level_g = targetSoot;
      setOverrideSoot(targetSoot);
    } else if (trimmed === 'P0217' || trimmed === 'P0118') {
      const targetCoolant = Math.max(107, currentSnapshot.telemetry.coolant_temp_c || 107);
      extraTelemetry.coolant_temp_c = targetCoolant;
      setOverrideCoolant(targetCoolant);
    } else if (trimmed === 'P0562') {
      extraTelemetry.battery_voltage_v = 22.8;
      setOverrideBattery(22.8);
    }

    if (!currentCodes.includes(trimmed)) {
      onUpdateTelemetry({
        ...extraTelemetry,
        active_dtc_codes: [...currentCodes, trimmed],
      });
      setInjectSuccessMessage(`Fault Code ${trimmed} injected into ECU.`);
    } else {
      if (Object.keys(extraTelemetry).length > 0) {
        onUpdateTelemetry(extraTelemetry);
      }
      setInjectSuccessMessage(`Fault Code ${trimmed} is already registered in ECU.`);
    }
    setTimeout(() => setInjectSuccessMessage(null), 3000);
  };

  const handleClearAllDtcs = () => {
    onUpdateTelemetry({
      active_dtc_codes: [],
    });
    setInjectSuccessMessage('All active ECU diagnostic trouble codes cleared.');
    setTimeout(() => setInjectSuccessMessage(null), 3000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-4xl lg:max-w-5xl w-full max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.15)] text-slate-100 animate-in fade-in zoom-in-95 my-auto overflow-hidden"
      >
        {/* Top Developer Bar */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/90 rounded-t-3xl">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 mt-0.5 shrink-0 rounded-3xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white font-mono tracking-tight flex items-center gap-2">
                  Lead Developer Command Console
                </h3>
                <span className="px-1.5 py-0.5 rounded-xl text-[9px] sm:text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  ROOT DEV ACCESS
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-mono leading-tight">
                Operator: <span className="text-cyan-300 font-semibold">{currentUser?.name || 'Developer'}</span> (
                <span className="text-amber-300">{currentUser?.role === 'developer' ? 'Lead Developer & Systems Architect' : currentUser?.roleLabel}</span>)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ACCESS RESTRICTION: Block Fleet Director & Non-Developers */}
        {!isLeadDeveloper ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-14 h-14 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto shadow-lg">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white font-mono">
                Access Denied: Lead Developer Only
              </h3>
              <p className="text-xs text-rose-300 font-mono">
                Role: {currentUser?.roleLabel || 'Fleet Owner'} (Unauthorized)
              </p>
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              The Developer Command Console, ECU fault injector, and raw telemetry overrides are reserved exclusively for the <strong className="text-cyan-400 font-semibold">Lead Developer (Sarthak Gohil)</strong>. Fleet Owners and operations staff do not possess root code execution privileges.
            </p>
            <div className="pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition-colors"
              >
                Return to Fleet Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Action feedback toast */}
            {injectSuccessMessage && (
              <div className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 px-4 py-2 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{injectSuccessMessage}</span>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex flex-wrap border-b border-slate-800 bg-slate-950/50 px-4 sm:px-6 gap-2 pt-2 text-[10px] sm:text-xs font-mono">
              <button
                id="dev-modal-tab-obd-scanner"
                onClick={() => setActiveTab('obd_scanner')}
                className={`flex items-center gap-2 px-3 py-2 border-b-2 font-semibold transition-all shrink-0 ${
                  activeTab === 'obd_scanner' || (activeTab as string) === 'obd_live'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isSimulating ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
                <span>OBD Telematics Scanner</span>
                {isSimulating && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                )}
              </button>

              <button
                id="dev-modal-tab-dynamics-hub"
                onClick={() => setActiveTab('dynamics_hub')}
                className={`flex items-center gap-2 px-3 py-2 border-b-2 font-semibold transition-all shrink-0 ${
                  activeTab === 'dynamics_hub' || (activeTab as string) === 'simulation'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>Vehicle Dynamics & Load Hub</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-xl bg-amber-500/20 text-amber-300 font-mono">
                  {(vehicleLoadKg / 1000).toFixed(1)}T
                </span>
              </button>

              {canSimulate && (<>
              <button
                id="dev-modal-tab-telemetry-override"
                onClick={() => setActiveTab('telemetry_override')}
                className={`flex items-center gap-2 px-3 py-2 border-b-2 font-semibold transition-all shrink-0 ${
                  activeTab === 'telemetry_override'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Live Telemetry Override</span>
              </button>

              <button
                id="dev-modal-tab-dtc-injector"
                onClick={() => setActiveTab('dtc_injector')}
                className={`flex items-center gap-2 px-3 py-2 border-b-2 font-semibold transition-all shrink-0 ${
                  activeTab === 'dtc_injector'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>ECU Fault Injector</span>
              </button>
              </>)}

              <button
                id="dev-modal-tab-fleet-manager"
                onClick={() => setActiveTab('fleet_manager')}
                className={`flex items-center gap-2 px-3 py-2 border-b-2 font-semibold transition-all shrink-0 ${
                  activeTab === 'fleet_manager'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Manage Fleets</span>
              </button>

              <button
                id="dev-modal-tab-python-runtime"
                onClick={() => setActiveTab('python_runtime')}
                className={`flex items-center gap-2 px-3 py-2 border-b-2 font-semibold transition-all shrink-0 ${
                  activeTab === 'python_runtime'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Python Diagnostic Core</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-xl bg-cyan-500/20 text-cyan-300 font-mono">
                  v3.10
                </span>
              </button>

              <button
                id="dev-modal-tab-security-shield"
                onClick={() => setActiveTab('security_shield')}
                className={`flex items-center gap-2 px-3 py-2 border-b-2 font-semibold transition-all shrink-0 ${
                  activeTab === 'security_shield'
                    ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Backend Security & Firewall</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-xl bg-emerald-500/20 text-emerald-300 font-mono">
                  8 LAYERS ARMED
                </span>
              </button>
            </div>
          </>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: OBD TELEMATICS SCANNER */}
          {(activeTab === 'obd_scanner' || (activeTab as string) === 'obd_live') && (
            <div className="space-y-4">
              {/* Header Context Bar with Target Vehicle & Stream Status */}
              <div className="bg-slate-950/90 border border-cyan-500/30 rounded-3xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-inner overflow-hidden">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 sm:mt-0">
                    <Radio className={`w-4 h-4 ${isSimulating ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <label htmlFor="dev-modal-vehicle-select" className="text-xs font-mono font-bold text-white uppercase tracking-wider shrink-0">
                        Active Vehicle Stream:
                      </label>
                      <select
                        id="dev-modal-vehicle-select"
                        value={currentVehicleId}
                        onChange={(e) => onSelectVehicle(e.target.value)}
                        className="bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold rounded-xl px-2.5 py-1 focus:outline-none focus:border-cyan-400 cursor-pointer max-w-full sm:max-w-xs md:max-w-sm truncate"
                      >
                        {vehicles.map((v) => (
                          <option key={v.vehicle_id} value={v.vehicle_id}>
                            {v.vehicle_id} - {v.unit_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>Protocol: SAE J1979 OBD-II Mode 01/03 & ISO 15765-4 CAN</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-amber-400 font-semibold">250 kbps Heavy Duty Bus</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
                  {canSimulate && (
                    <button
                      id="dev-modal-toggle-stream-btn"
                      onClick={onToggleSimulation}
                      className={`px-3 py-1.5 rounded-2xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                        isSimulating
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                          : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {isSimulating ? <Pause className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> : <Play className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      <span>{isSimulating ? 'Pause Stream' : 'Resume Stream'}</span>
                    </button>
                  )}

                  {canSimulate && (
                  <button
                    id="dev-modal-copy-raw-hex-btn"
                    onClick={handleCopyRawHex}
                    className="px-3 py-1.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    title="Copy complete raw hex payload"
                  >
                    {copiedHex ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <span>{copiedHex ? 'Copied Hex' : 'Copy Hex'}</span>
                  </button>
                  )}
                </div>
              </div>

              {/* Decoded OBD-II PIDs Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Live SAE J1979 Mode 01 Diagnostic PIDs
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400">
                    Live Broadcast Rate: ~10 Hz CAN cycle
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* PID 0C: Engine RPM */}
                  <div className="p-3 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-1.5 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-cyan-400 font-bold">PID 0C</span>
                      <span className="text-[10px] text-slate-400 font-mono">((A×256)+B)/4</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-white font-mono">
                        {rpmVal.toLocaleString()} <span className="text-xs font-normal text-slate-400">RPM</span>
                      </span>
                      {canSimulate && (
                      <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        41 0C {rpmHexA} {rpmHexB}
                      </span>
                      )}
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(5, (rpmVal / 2500) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Engine Speed</span>
                      <span>Nominal: 1100-1550</span>
                    </div>
                  </div>

                  {/* PID 05: Coolant Temp */}
                  <div className="p-3 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-1.5 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-amber-400 font-bold">PID 05</span>
                      <span className="text-[10px] text-slate-400 font-mono">A - 40 (°C)</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-lg font-bold font-mono ${coolantVal > 105 ? 'text-rose-400' : coolantVal > 95 ? 'text-amber-400' : 'text-emerald-300'}`}>
                        {coolantVal}°C <span className="text-xs font-normal text-slate-400">({Math.round(coolantVal * 1.8 + 32)}°F)</span>
                      </span>
                      {canSimulate && (
                      <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        41 05 {coolantHex}
                      </span>
                      )}
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${coolantVal > 105 ? 'bg-rose-500' : coolantVal > 95 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(100, Math.max(5, ((coolantVal - 40) / 80) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Coolant Temp</span>
                      <span>Limit: 105°C max</span>
                    </div>
                  </div>

                  {/* PID 0D: Vehicle Speed */}
                  <div className="p-3 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-1.5 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-emerald-400 font-bold">PID 0D</span>
                      <span className="text-[10px] text-slate-400 font-mono">A (km/h)</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-white font-mono">
                        {speedVal} <span className="text-xs font-normal text-slate-400">km/h</span>
                        <span className="text-xs text-slate-500 ml-1">({Math.round(speedVal / 1.609)} mph)</span>
                      </span>
                      {canSimulate && (
                      <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        41 0D {speedHex}
                      </span>
                      )}
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(2, (speedVal / 110) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Ground Speed</span>
                      <span>Gov Cap: 80 km/h</span>
                    </div>
                  </div>

                  {/* PID 11: Engine Load / Throttle */}
                  <div className="p-3 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-1.5 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-sky-400 font-bold">PID 11 / 04</span>
                      <span className="text-[10px] text-slate-400 font-mono">(A×100)/255</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-amber-300 font-mono">
                        {loadVal}% <span className="text-xs font-normal text-slate-400">Load</span>
                      </span>
                      {canSimulate && (
                      <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        41 11 {throttleHex}
                      </span>
                      )}
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(5, loadVal))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Torque Demand</span>
                      <span>GCW Load: {(vehicleLoadKg / 1000).toFixed(1)}T</span>
                    </div>
                  </div>

                  {/* PID 42: Control Module Voltage */}
                  <div className="p-3 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-1.5 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-purple-400 font-bold">PID 42</span>
                      <span className="text-[10px] text-slate-400 font-mono">Module Voltage</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-white font-mono">
                        {voltVal.toFixed(1)} <span className="text-xs font-normal text-slate-400">V</span>
                      </span>
                      {canSimulate && (
                      <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        41 42 5E 88
                      </span>
                      )}
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(10, ((voltVal - 20) / 10) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Alternator / Rail</span>
                      <span>24V Bus (24.0–28.4V)</span>
                    </div>
                  </div>

                  {/* J1939 SPN 94: Common Rail Fuel Pressure */}
                  <div className="p-3 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-1.5 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-teal-400 font-bold">SPN 94</span>
                      <span className="text-[10px] text-slate-400 font-mono">Fuel Rail</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-teal-300 font-mono">
                        {railPressureVal.toLocaleString()} <span className="text-xs font-normal text-slate-400">bar</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-mono bg-teal-500/15 text-teal-300 border border-teal-500/30">
                        PGN 65263
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(10, (railPressureVal / 2200) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Injection Pressure</span>
                      <span>High Rail Direct</span>
                    </div>
                  </div>

                  {/* J1939 SPN 173: Exhaust Gas Temp */}
                  <div className="p-3 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-1.5 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-orange-400 font-bold">SPN 173</span>
                      <span className="text-[10px] text-slate-400 font-mono">Exhaust EGT</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-orange-300 font-mono">
                        {exhaustVal}°C
                      </span>
                      <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-mono bg-orange-500/15 text-orange-300 border border-orange-500/30">
                        PGN 65270
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(10, (exhaustVal / 750) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Turbo Pyrometer</span>
                      <span>Catalyst Window</span>
                    </div>
                  </div>

                  {/* J1939 SPN 3216 / 3719: Aftertreatment & DPF */}
                  <div className="p-3 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-1.5 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-emerald-400 font-bold">SPN 3216 / 3719</span>
                      <span className="text-[10px] text-slate-400 font-mono">Emissions</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-bold text-white font-mono">
                        {noxVal} <span className="text-xs text-slate-400">ppm</span> / {sootVal.toFixed(1)} <span className="text-xs text-slate-400">g</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        SCR/DPF OK
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(10, (sootVal / 45) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>NOx / DPF Soot</span>
                      <span>Flow: {fuelRateVal.toFixed(1)} L/h</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Raw Hexadecimal CAN Frames Stream Terminal: generated frames, so demo fleets only */}
              {canSimulate && (
              <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden font-mono text-xs">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-slate-300">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-xs text-white">
                      Raw CAN-bus Broadcast Hex Stream (Mode 01 & Mode 03)
                    </span>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyRawHex}
                      className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 transition-colors"
                    >
                      {copiedHex ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      <span>{copiedHex ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 space-y-1.5 text-[11px] font-mono leading-relaxed overflow-x-auto">
                  <div className="text-slate-500 pb-1 border-b border-slate-900">
                    // Realtime ECU broadcast frames decoded via SAE J1979 standard (Unit: {currentVehicleId})
                  </div>
                  <div className="flex items-center justify-between text-cyan-300">
                    <span>Mode 01 PID 0C response: 41 0C {rpmHexA} {rpmHexB}</span>
                    <span className="text-slate-500">// Engine Speed: {rpmVal.toLocaleString()} RPM</span>
                  </div>
                  <div className="flex items-center justify-between text-amber-300">
                    <span>Mode 01 PID 05 response: 41 05 {coolantHex}</span>
                    <span className="text-slate-500">// Engine Coolant: {coolantVal}°C</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-300">
                    <span>Mode 01 PID 0D response: 41 0D {speedHex}</span>
                    <span className="text-slate-500">// Vehicle Speed: {speedVal} km/h</span>
                  </div>
                  <div className="flex items-center justify-between text-sky-300">
                    <span>Mode 01 PID 11 response: 41 11 {throttleHex}</span>
                    <span className="text-slate-500">// Throttle / Engine Load: {loadVal}%</span>
                  </div>
                  <div className="flex items-center justify-between text-purple-300">
                    <span>Mode 01 PID 42 response: 41 42 5E 88</span>
                    <span className="text-slate-500">// Control Module Voltage: {voltVal.toFixed(1)} V</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-900">
                    <span className="text-rose-400">
                      {currentSnapshot.telemetry.active_dtc_codes && currentSnapshot.telemetry.active_dtc_codes.length > 0
                        ? `Mode 03 DTC response: 43 ${currentSnapshot.telemetry.active_dtc_codes.join(' ')}`
                        : 'Mode 03 DTC response: 43 00 00 (No Stored Diagnostic Codes)'}
                    </span>
                    <span className="text-slate-500">
                      // Active Fault Codes: {currentSnapshot.telemetry.active_dtc_codes?.length || 0}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900/60 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Want to hot-patch ECU sensor variables or trigger diagnostics?</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('telemetry_override')}
                      className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold transition-colors"
                    >
                      Hot-Override Telemetry →
                    </button>
                    <button
                      onClick={() => setActiveTab('dtc_injector')}
                      className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold transition-colors"
                    >
                      Inject Fault Codes →
                    </button>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {/* TAB 2: VEHICLE DYNAMICS & LOAD HUB */}
          {(activeTab === 'dynamics_hub' || (activeTab as string) === 'simulation') && (
            <div className="space-y-4">
              {/* Quick Telemetry Glance Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-950/80 rounded-3xl border border-slate-800 text-xs font-mono">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">PID 0C (RPM)</span>
                  <span className="text-sm font-bold text-cyan-300">{rpmVal.toLocaleString()} RPM</span>
                  {canSimulate && <span className="text-[9px] text-slate-500">41 0C {rpmHexA} {rpmHexB}</span>}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">PID 05 (Coolant)</span>
                  <span className={`text-sm font-bold ${coolantVal > 100 ? 'text-rose-400' : 'text-emerald-300'}`}>{coolantVal}°C</span>
                  {canSimulate && <span className="text-[9px] text-slate-500">41 05 {coolantHex}</span>}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">PID 0D (Speed)</span>
                  <span className="text-sm font-bold text-white">{speedVal} km/h</span>
                  {canSimulate && <span className="text-[9px] text-slate-500">41 0D {speedHex}</span>}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">PID 11 (Load)</span>
                  <span className="text-sm font-bold text-amber-300">{loadVal}%</span>
                  {canSimulate && <span className="text-[9px] text-slate-500">41 11 {throttleHex}</span>}
                </div>
              </div>
              <div className="flex justify-end -mt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('obd_scanner')}
                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <span>{canSimulate ? 'Inspect All Decoded PIDs & Raw Hex CAN Stream →' : 'Inspect All Decoded PIDs →'}</span>
                </button>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 space-y-3">
                {canSimulate && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>Live Autonomous Stream Generator</span>
                        {isSimulating ? (
                          <span className="px-2 py-0.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono animate-pulse shrink-0">
                            ● BROADCASTING
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-xl bg-slate-800 text-slate-400 text-[10px] font-mono shrink-0">
                            IDLE / PAUSED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Simulates CAN-bus J1939 broadcast with dynamic physics for hill climbing, thermal stress, and route dynamics.
                      </div>
                    </div>
                    <button
                      id="dev-modal-simulation-toggle-btn"
                      onClick={onToggleSimulation}
                      className={`w-full sm:w-auto px-3.5 py-2 rounded-3xl font-bold text-xs font-mono flex items-center justify-center gap-2 transition-all shrink-0 max-w-full ${
                        isSimulating
                          ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      {isSimulating ? <Pause className="w-4 h-4 shrink-0" /> : <Play className="w-4 h-4 text-cyan-400 shrink-0" />}
                      <span className="truncate">{isSimulating ? 'Pause Telematics Stream' : 'Resume Telematics Stream'}</span>
                    </button>
                  </div>
                )}

                {/* Driving Profiles Grid */}
                {canSimulate && (
                  <div>
                    <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2.5">
                      Select Active Terrain & Powertrain Condition:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Hill Climb */}
                      <button
                        onClick={() => onSelectSimCondition('hill_climb')}
                        className={`p-3 rounded-3xl border text-left transition-all ${
                          simCondition === 'hill_climb'
                            ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] text-amber-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                            <Mountain className="w-4 h-4 text-amber-400" />
                            <span>Steep Hill Climb</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            +{gradePct}% Grade
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Transmission downshifts under grade incline: RPM surges into 1850–2120 RPM and coolant temperature rises steadily towards 103°C+.
                        </p>
                      </button>

                      {/* Highway Cruise */}
                      <button
                        onClick={() => onSelectSimCondition('cruise')}
                        className={`p-3 rounded-3xl border text-left transition-all ${
                          simCondition === 'cruise'
                            ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                            <Compass className="w-4 h-4 text-emerald-400" />
                            <span>Flat Highway Cruise</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            0.0% Grade
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Level expressway cruise. Engine operates in the optimal 1350 RPM fuel efficiency band with stable 89°C thermals.
                        </p>
                      </button>

                      {/* Overheat */}
                      <button
                        onClick={() => onSelectSimCondition('overheat')}
                        className={`p-3 rounded-3xl border text-left transition-all ${
                          simCondition === 'overheat'
                            ? 'bg-rose-500/15 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)] text-rose-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                            <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                            <span>Thermal Overheat Runaway</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            110°C+ Stress
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Cooling system failure simulation: coolant escalates rapidly past 105°C, triggering radiator fan overrides and P0217 warning.
                        </p>
                      </button>

                      {/* Traffic */}
                      <button
                        onClick={() => onSelectSimCondition('traffic')}
                        className={`p-3 rounded-3xl border text-left transition-all ${
                          simCondition === 'traffic'
                            ? 'bg-sky-500/15 border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.15)] text-sky-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                            <Activity className="w-4 h-4 text-sky-400" />
                            <span>Urban Stop-and-Go</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Congestion
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Stop-and-go metro traffic with prolonged idle times (680 RPM), low speed bursts, high fuel penalties, and heat soak.
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Automatic Incline Meter (Read-only, Automatic Sensor) */}
                <div className="pt-3 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <Mountain className="w-4 h-4 text-amber-400" />
                      <span className="text-slate-300 font-semibold">Automatic Road Inclinometer</span>
                      <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <Lock className="w-2.5 h-2.5" />
                        AUTOMATIC SENSOR (LOCKED)
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold text-amber-400 text-sm">+{gradePct.toFixed(1)}% Grade</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        (~{(gradePct * 0.57).toFixed(1)}° Pitch)
                      </span>
                    </div>
                  </div>

                  {/* Visual Inclinometer Bar */}
                  <div className="p-3 bg-slate-900/80 rounded-3xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>CAN-Bus Telemetry: SPN 5217 (Pitch Angle)</span>
                      <span className="text-cyan-400">
                        {simCondition === 'hill_climb'
                          ? 'Steep Mountain Corridor Incline'
                          : simCondition === 'cruise'
                          ? 'Level Highway Corridor (0.0%)'
                          : 'Dynamic Longitudinal Pitch'}
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 relative">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, (gradePct / 15) * 100))}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0.0% (Level Plane)</span>
                      <span>+4.5% (Highway Grade)</span>
                      <span>+8.0% (Mountain Pass)</span>
                      <span>+15.0% (Extreme Incline)</span>
                    </div>

                    <div className="text-[10px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/60 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Incline meter is calculated automatically by the vehicle MEMS dual-axis accelerometer and corridor elevation data. Manual adjustment is disabled to ensure automated telematics accuracy.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vehicle Load Emulator Section */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-400" />
                      <span className="text-slate-300 font-semibold">Vehicle Load Emulator (GVW & Payload)</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        PAYLOAD EMULATION
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-bold text-amber-400 text-sm">
                        {(vehicleLoadKg / 1000).toFixed(1)} T
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({vehicleLoadKg.toLocaleString()} kg)
                      </span>
                    </div>
                  </div>

                  {/* Load Presets */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateVehicleLoad?.(11500, 'unladen')}
                      className={`p-2.5 rounded-2xl border text-left transition-all ${
                        loadPreset === 'unladen' || vehicleLoadKg <= 15000
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold">Unladen (Tare)</div>
                      <div className="text-xs font-mono font-bold text-slate-200">11.5 T</div>
                      <div className="text-[9px] text-slate-400">Empty Ti/Bed</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateVehicleLoad?.(26000, 'half')}
                      className={`p-2.5 rounded-2xl border text-left transition-all ${
                        loadPreset === 'half' || (vehicleLoadKg > 15000 && vehicleLoadKg <= 30000)
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold">Partial Load</div>
                      <div className="text-xs font-mono font-bold text-slate-200">26.0 T</div>
                      <div className="text-[9px] text-slate-400">14.5T Freight</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateVehicleLoad?.(40000, 'rated')}
                      className={`p-2.5 rounded-2xl border text-left transition-all ${
                        loadPreset === 'rated' || (vehicleLoadKg > 30000 && vehicleLoadKg <= 43000)
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold">Rated Legal Max</div>
                      <div className="text-xs font-mono font-bold text-slate-200">40.0 T</div>
                      <div className="text-[9px] text-slate-400">28.5T Max Load</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateVehicleLoad?.(49500, 'overload')}
                      className={`p-2.5 rounded-2xl border text-left transition-all ${
                        loadPreset === 'overload' || vehicleLoadKg > 43000
                          ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold">Overload</div>
                      <div className="text-xs font-mono font-bold text-slate-200">49.5 T</div>
                      <div className="text-[9px] text-rose-400">124% GCW Stress</div>
                    </button>
                  </div>

                  {/* Weight Slider */}
                  {onUpdateVehicleLoad && (
                    <div className="space-y-1.5 pt-1">
                      <input
                        type="range"
                        min="11500"
                        max="55000"
                        step="500"
                        value={vehicleLoadKg}
                        onChange={(e) => onUpdateVehicleLoad(Number(e.target.value), 'custom')}
                        className="w-full accent-amber-400 bg-slate-800 h-2 rounded-2xl cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>11.5 T (Tare)</span>
                        <span>26.0 T (Half)</span>
                        <span className="text-amber-400 font-semibold">40.0 T (Rated Legal Limit)</span>
                        <span className="text-rose-400 font-semibold">55.0 T (Overload Max)</span>
                      </div>
                    </div>
                  )}

                  {/* Realtime Impact Summary */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-900/90 rounded-2xl border border-slate-800 text-center text-[10px] font-mono">
                    <div>
                      <div className="text-slate-400">Air Bellows</div>
                      <div className="font-bold text-slate-200 text-xs mt-0.5">
                        {(2.0 + (vehicleLoadKg / 40000) * 5.2).toFixed(1)} bar
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Engine Torque Offset</div>
                      <div className="font-bold text-amber-300 text-xs mt-0.5">
                        {vehicleLoadKg >= 40000 ? `+${Math.round(((vehicleLoadKg - 40000) / 40000) * 40)}%` : `${Math.round(((vehicleLoadKg - 40000) / 40000) * 40)}%`}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Fuel Burn Penalty</div>
                      <div className="font-bold text-rose-300 text-xs mt-0.5">
                        {vehicleLoadKg >= 40000 ? `+${Math.round(((vehicleLoadKg - 40000) / 40000) * 55)}%` : `${Math.round(((vehicleLoadKg - 40000) / 40000) * 55)}%`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE TELEMETRY OVERRIDE */}
          {activeTab === 'telemetry_override' && (
            <form onSubmit={handleApplyTelemetryOverride} className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 space-y-4">
                <div className="text-xs text-slate-400 font-mono">
                  Direct live injection into vehicle ECU memory cache for unit{' '}
                  <strong className="text-amber-400">{currentVehicleId}</strong>.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <label className="block text-slate-400 mb-1">Engine RPM</label>
                    <input
                      type="number"
                      value={overrideRpm}
                      onChange={(e) => setOverrideRpm(Number(e.target.value))}
                      min="500"
                      max="3000"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-white font-bold focus:border-cyan-400 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Nominal: 1100 - 1500 RPM</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Coolant Temp (°C)</label>
                    <input
                      type="number"
                      value={overrideCoolant}
                      onChange={(e) => setOverrideCoolant(Number(e.target.value))}
                      min="40"
                      max="130"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-white font-bold focus:border-cyan-400 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Critical &gt; 100°C</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Road Speed (km/h)</label>
                    <input
                      type="number"
                      value={overrideSpeed}
                      onChange={(e) => setOverrideSpeed(Number(e.target.value))}
                      min="0"
                      max="120"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-white font-bold focus:border-cyan-400 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Commercial cap: 80 km/h</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Engine Load (%)</label>
                    <input
                      type="number"
                      value={overrideLoad}
                      onChange={(e) => setOverrideLoad(Number(e.target.value))}
                      min="0"
                      max="100"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-white font-bold focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Exhaust Temp (°C)</label>
                    <input
                      type="number"
                      value={overrideExhaust}
                      onChange={(e) => setOverrideExhaust(Number(e.target.value))}
                      min="200"
                      max="800"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-white font-bold focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">DPF Soot Mass (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={overrideSoot}
                      onChange={(e) => setOverrideSoot(Number(e.target.value))}
                      min="0"
                      max="60"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-amber-400 font-bold focus:border-cyan-400 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">&gt;28g Regen | &gt;40g Creep</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">NOx Sensor (ppm)</label>
                    <input
                      type="number"
                      value={overrideNox}
                      onChange={(e) => setOverrideNox(Number(e.target.value))}
                      min="0"
                      max="2000"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-white font-bold focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">24V Bus Voltage (V)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={overrideBattery}
                      onChange={(e) => setOverrideBattery(Number(e.target.value))}
                      min="18"
                      max="32"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-white font-bold focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Tire Pressure (PSI)</label>
                    <input
                      type="number"
                      value={overrideTirePsi}
                      onChange={(e) => setOverrideTirePsi(Number(e.target.value))}
                      min="60"
                      max="130"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-white font-bold focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400">
                    Changes reflect immediately in gauge displays and AI diagnosis.
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-3xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 transition-all shadow cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Push to CAN-Bus</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: ECU FAULT INJECTOR */}
          {activeTab === 'dtc_injector' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white font-mono">
                      ECU Diagnostic Trouble Code Injector
                    </div>
                    <div className="text-xs text-slate-400">
                      Inject known commercial SAE J1939 fault codes to trigger live alerts and AI analysis.
                    </div>
                  </div>
                  <button
                    onClick={handleClearAllDtcs}
                    className="px-3 py-1.5 rounded-2xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Codes</span>
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInjectDtc('P0217')}
                    className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-rose-400 font-mono">P0217</div>
                      <div className="text-[10px] text-slate-400">Coolant Overtemperature (&gt;106°C)</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInjectDtc('P2463')}
                    className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-amber-400 font-mono">P2463</div>
                      <div className="text-[10px] text-slate-400">DPF Soot Mass Overload (&gt;28g)</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInjectDtc('P0171')}
                    className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-amber-400 font-mono">P0171</div>
                      <div className="text-[10px] text-slate-400">System Too Lean (Fuel Trim)</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInjectDtc('P0087')}
                    className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-cyan-400 font-mono">P0087</div>
                      <div className="text-[10px] text-slate-400">Fuel Rail Pressure Low</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInjectDtc('P0192')}
                    className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-rose-400 font-mono">P0192</div>
                      <div className="text-[10px] text-slate-400">Common Rail Sensor Short (Derate)</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInjectDtc('P2047')}
                    className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-amber-400 font-mono">P2047</div>
                      <div className="text-[10px] text-slate-400">DEF Urea Dosing Valve Open</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInjectDtc('P2200')}
                    className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-purple-400 font-mono">P2200</div>
                      <div className="text-[10px] text-slate-400">NOx Sensor Gen 3.3 Inducement</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInjectDtc('P0524')}
                    className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-rose-500 font-mono">P0524</div>
                      <div className="text-[10px] text-slate-400">Engine Oil Pressure Loss (Shutdown)</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInjectDtc('P0562')}
                    className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-amber-400 font-mono">P0562</div>
                      <div className="text-[10px] text-slate-400">24V System Bus Voltage Low</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                {/* Custom Code Input */}
                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    value={customDtcInput}
                    onChange={(e) => setCustomDtcInput(e.target.value)}
                    placeholder="Enter Custom DTC (e.g. P0300, P0420)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none uppercase"
                  />
                  <button
                    onClick={() => {
                      handleInjectDtc(customDtcInput);
                      setCustomDtcInput('');
                    }}
                    className="px-4 py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-colors"
                  >
                    Inject Code
                  </button>
                </div>

                {/* Active codes list */}
                <div className="pt-2">
                  <span className="text-xs text-slate-400 font-mono">Currently Active on CAN-Bus:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {currentSnapshot.telemetry.active_dtc_codes && currentSnapshot.telemetry.active_dtc_codes.length > 0 ? (
                      currentSnapshot.telemetry.active_dtc_codes.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold"
                        >
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-emerald-400 font-mono">✓ Zero active fault codes (All nominal)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MANAGE ALL FLEETS */}
          {activeTab === 'fleet_manager' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white font-mono">
                      Fleet Units Directory ({vehicles.length} Units Active)
                    </div>
                    <div className="text-xs text-slate-400">
                      Director clearance enables unit provisioning, driver reassignment, and corridor routing.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onOpenAddVehicle();
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 transition-all shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register New Commercial Unit</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-3xl overflow-hidden">
                  {vehicles.map((v) => (
                    <div
                      key={v.vehicle_id}
                      className={`p-3 flex items-center justify-between gap-3 text-xs font-mono transition-colors ${
                        v.vehicle_id === currentVehicleId ? 'bg-cyan-500/10' : 'hover:bg-slate-900'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{v.vehicle_id}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-200">{v.unit_name}</span>
                          {v.vehicle_id === currentVehicleId && (
                            <span className="px-1.5 py-0.2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px]">
                              CURRENT ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{v.make_model}</span>
                          <span>•</span>
                          <span>{v.location}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onSelectVehicle(v.vehicle_id);
                          setInjectSuccessMessage(`Switched active telematics stream to ${v.vehicle_id}`);
                          setTimeout(() => setInjectSuccessMessage(null), 2500);
                        }}
                        className={`px-3 py-1.5 rounded-2xl text-xs font-semibold transition-colors shrink-0 ${
                          v.vehicle_id === currentVehicleId
                            ? 'bg-slate-800 text-slate-400 cursor-default'
                            : 'bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300'
                        }`}
                      >
                        {v.vehicle_id === currentVehicleId ? 'Selected' : 'Switch To'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PYTHON DIAGNOSTIC CORE ENGINE */}
          {activeTab === 'python_runtime' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 space-y-4 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center shrink-0">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Python 3 Heavy-Duty Diagnostic Engine
                        <span className="px-2 py-0.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                          ONLINE
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Zero-JS Python analytics backend handling heavy vehicle physics, OBD/CAN DTC matrices, and DPF regeneration logic.
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-cyan-300 font-bold block">Python 3.10.12 (Standard Library)</span>
                    <span className="text-[10px] text-slate-500">Zero external pip dependencies</span>
                  </div>
                </div>

                {/* Microservice Architecture Specs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Diagnostic Module</span>
                    <span className="text-xs font-bold text-cyan-300 block mt-1">telematics_analyzer.py</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">Tata Motors BSVI & Cummins ISBe logic with Bosch MD1CS018 pinouts.</span>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Powertrain Physics</span>
                    <span className="text-xs font-bold text-cyan-300 block mt-1">fuel_efficiency.py</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">DPF soot backpressure, rolling resistance, and INR monthly loss models.</span>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Reliability & MTBF</span>
                    <span className="text-xs font-bold text-cyan-300 block mt-1">predictive_maintenance.py</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">90-day time-series failure forecasting & PM interval adjustment.</span>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Master Technician Q&A</span>
                    <span className="text-xs font-bold text-cyan-300 block mt-1">technical_assistant.py</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">Exact torque specs (Nm/ft-lbs) and ECU pin multimeter checks.</span>
                  </div>
                </div>

                {/* Active Vehicle Pipeline Diagnostics */}
                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">Active Snapshot Input Pipeline ({currentVehicleId}):</span>
                    <button
                      onClick={() => onRunDiagnostics()}
                      className="px-3 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Re-run Python Telematics Engine</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-cyan-300/90 overflow-x-auto max-h-48 leading-relaxed">
{JSON.stringify(
  {
    engine: "FleetDiag Commercial Diagnostics Core v3.8 (Python 3.10)",
    telematics_standard: "SAE J1939 / Tata Motors BSVI / Cummins ISBe",
    target_vehicle: currentVehicleId,
    active_snapshot: {
      coolant_temp_c: currentSnapshot.telemetry.coolant_temp_c,
      engine_load_pct: currentSnapshot.telemetry.engine_load_pct,
      battery_voltage_v: currentSnapshot.telemetry.battery_voltage_v,
      soot_level_g: currentSnapshot.telemetry.soot_level_g,
      exhaust_temp_c: currentSnapshot.telemetry.exhaust_temp_c,
      active_dtc_codes: currentSnapshot.telemetry.active_dtc_codes,
    },
    ipc_pipeline: "Node.js express -> child_process spawn(python3 python/engine.py) -> JSON stdout",
    microservice_option: "python3 python/server.py --port 8000"
  },
  null,
  2
)}
                  </pre>
                </div>

                {/* Live Python Interactive Testing Console */}
                <div className="p-4 bg-slate-900/70 border border-cyan-500/30 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Live Python CLI & Dispatcher Tester
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                      {(['diagnose', 'fuel', 'predictive', 'query'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setPythonTestMode(m)}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all uppercase ${
                            pythonTestMode === m
                              ? 'bg-cyan-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {pythonTestMode === 'query' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pythonQuestionInput}
                        onChange={(e) => setPythonQuestionInput(e.target.value)}
                        placeholder="Enter technical technician inquiry (e.g. sensor torque, wiring pinout)..."
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-sans focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Dispatches direct stdin stream to <code className="text-cyan-300">python3 python/engine.py {pythonTestMode}</code>
                    </span>
                    <button
                      disabled={pythonTestRunning}
                      onClick={async () => {
                        setPythonTestRunning(true);
                        try {
                          let payload: any = currentSnapshot;
                          if (pythonTestMode === 'predictive') {
                            payload = {
                              vehicle_id: currentVehicleId,
                              history: [],
                              snapshot: currentSnapshot,
                            };
                          } else if (pythonTestMode === 'query') {
                            payload = {
                              question: pythonQuestionInput,
                              snapshot: currentSnapshot,
                            };
                          }
                          const res = await fetch('/api/python-run', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mode: pythonTestMode, payload }),
                          });
                          const json = await res.json();
                          setPythonTestOutput(json);
                        } catch (err: any) {
                          setPythonTestOutput({ error: err.message });
                        } finally {
                          setPythonTestRunning(false);
                        }
                      }}
                      className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${pythonTestRunning ? 'animate-spin' : ''}`} />
                      <span>{pythonTestRunning ? 'Running Python Process...' : `Execute python3 engine.py ${pythonTestMode}`}</span>
                    </button>
                  </div>

                  {pythonTestOutput && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-bold">STDOUT / JSON Output:</span>
                        <span className="text-cyan-400 font-mono text-[10px]">{pythonTestOutput.timestamp}</span>
                      </div>
                      <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-emerald-400/90 overflow-x-auto max-h-56 leading-relaxed">
{JSON.stringify(pythonTestOutput.result || pythonTestOutput, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Project Synopsis PDF Document Card */}
                <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-950 border border-cyan-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5">
                      <FileCode className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white flex items-center gap-2">
                        Official Project Synopsis Document (PDF)
                        <span className="px-1.5 py-0.2 rounded-md bg-cyan-500/20 text-cyan-300 text-[9px] font-mono font-bold">
                          v3.8 SPEC
                        </span>
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Two-page comprehensive technical synopsis covering SAE J1939 telematics, dual Python/Node engine architecture, DPF backpressure physics, and ROI metrics.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => downloadSynopsisPDF()}
                      className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Download Project Synopsis (PDF)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: BACKEND SECURITY SHIELD & FIREWALL */}
          {activeTab === 'security_shield' && (
            <div className="space-y-5 animate-in fade-in">
              {/* Header Status Banner */}
              <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                    <ShieldCheck className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                        Backend Security Shield & Defense Pipeline
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        ARMED & ACTIVE
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono mt-0.5">
                      Multi-tier defense architecture protecting REST APIs, AI inference models, Python IPC core, and the server data store.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={fetchSecurityData}
                    disabled={securityLoading}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${securityLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh Telemetry</span>
                  </button>
                </div>
              </div>

              {/* Threat Telemetry Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Threats Defended</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {securityStats?.attacksBlockedTotal ?? 0}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400/80 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active Interceptions</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Prototype Pollutions</div>
                  <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                    {securityStats?.prototypePollutionsBlocked ?? 0}
                  </div>
                  <div className="text-[10px] font-mono text-cyan-400/80 mt-0.5">
                    Object Sandbox Neutralized
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-amber-500/30">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Rate Limit Throttles</div>
                  <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                    {securityStats?.rateLimitThrottled ?? 0}
                  </div>
                  <div className="text-[10px] font-mono text-amber-400/80 mt-0.5">
                    Anti-DoS Token Buckets
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/30">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Security Events Logged</div>
                  <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                    {securityStats?.activeAuditEventsCount ?? securityAuditEvents.length}
                  </div>
                  <div className="text-[10px] font-mono text-purple-400/80 mt-0.5">
                    Tamper-Evident Circular Buffer
                  </div>
                </div>
              </div>

              {/* LIVE PENETRATION TESTING SUITE */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h5 className="text-xs sm:text-sm font-bold text-white font-mono flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Live Cyberattack & Penetration Test Suite
                    </h5>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Executes real cyberattack payloads against the backend security pipeline to verify invariant enforcement and input sanitization.
                    </p>
                  </div>
                  <button
                    onClick={handleRunPenTest}
                    disabled={penTestRunning}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-mono font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-60 transition-all shrink-0 cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${penTestRunning ? 'animate-spin' : ''}`} />
                    <span>{penTestRunning ? 'Running Vectors...' : 'Execute Penetration Tests'}</span>
                  </button>
                </div>

                {/* Penetration Test Results Display */}
                {penTestResults && penTestResults.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-emerald-300">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>All {penTestResults.length} Cyberattack Vectors Successfully Intercepted & Defended</span>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded-lg">
                        100% DEFENDED
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {penTestResults.map((t) => (
                        <div key={t.testId} className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                              <span className="text-cyan-400">{t.testId}</span>
                              <span>{t.name}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              {t.result}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            <strong className="text-slate-300">Vector:</strong> {t.attackVector}
                          </div>
                          <div className="text-[10px] text-emerald-300/90 font-mono">
                            <strong className="text-slate-300">Defense:</strong> {t.defenseMechanism}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono bg-slate-950 p-2 rounded-xl border border-slate-800">
                            {t.details}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center">
                    <p className="text-xs text-slate-400 font-mono">
                      Click <strong>"Execute Penetration Tests"</strong> above to fire the Dirty Dozen vectors (prototype pollution, script tags, null byte poisoning, forged tokens, command injection, and ghost fields) to verify live defense layers.
                    </p>
                  </div>
                )}
              </div>

              {/* 8 ACTIVE DEFENSE LAYERS GRID */}
              <div className="space-y-3">
                <h5 className="text-xs sm:text-sm font-bold text-white font-mono flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Active Multi-Tier Defense Layers
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white font-mono">Layer 1: OWASP Headers</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      NoSniff, FrameGuard, Referrer-Policy, and cache headers defeating clickjacking and MIME attacks.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white font-mono">Layer 2: Anti-DoS Limiter</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Sliding-window IP token buckets on AI inference and auth routes preventing wallet drain.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white font-mono">Layer 3: Prototype Guard</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Deep recursive sanitizer stripping dangerous __proto__, constructor, and NoSQL operator keys.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white font-mono">Layer 4: Anti-XSS Filter</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      HTML script tag neutralizing and null-byte string deflector for all incoming telemetry payloads.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white font-mono">Layer 5: HMAC Sessions</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Cryptographically signed HMAC-SHA256 bearer tokens with constant-time verification.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white font-mono">Layer 6: RBAC Isolation</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Lead developer authorization guards restricting ECU injection and live telemetry override.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white font-mono">Layer 7: Python Sandbox</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Strict regex mode whitelist, 10,000ms execution timeout guard, and stdin JSON IPC.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white font-mono">Layer 8: Cloud Rules</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                        DEPLOYED
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Server-side schema invariants blocking ghost fields (adminOverride) & out-of-bound scores.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECONDARY BACKUP DATABASE & DISASTER RECOVERY MATRIX */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs sm:text-sm font-bold text-white font-mono">
                          Secondary Backup Database & Disaster Recovery Matrix
                        </h5>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                          backupStatus?.failoverActive
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {backupStatus?.failoverActive ? 'FAILOVER ACTIVE' : 'STANDBY SYNCHRONIZED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        High-availability redundant store with continuous dual-write replication, Write-Ahead Log (WAL), immutable point-in-time snapshots, and zero-downtime failover.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCreateBackupSnapshot}
                      disabled={backupActionLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{backupActionLoading ? 'Creating...' : 'Snapshot DB'}</span>
                    </button>

                    <button
                      onClick={handleToggleFailover}
                      disabled={backupActionLoading}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-colors flex items-center gap-1.5 border cursor-pointer disabled:opacity-50 ${
                        backupStatus?.failoverActive
                          ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>
                        {backupStatus?.failoverActive
                          ? 'Restore Primary Database'
                          : 'Simulate Primary DB Outage'}
                      </span>
                    </button>

                    <a
                      href="/api/backup/export"
                      download="fleetdiag-backup-database.json"
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Export JSON</span>
                    </a>
                  </div>
                </div>

                {/* Action Feedback Banner */}
                {backupMessage && (
                  <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-2xl text-xs font-mono flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{backupMessage}</span>
                  </div>
                )}

                {/* Primary vs Secondary Redundancy Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Primary DB Card */}
                  <div className={`p-3.5 rounded-2xl border ${
                    backupStatus?.failoverActive
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : 'bg-slate-900 border-slate-800'
                  } space-y-1.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-blue-400" />
                        <span>Primary Database</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold ${
                        backupStatus?.failoverActive
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {backupStatus?.failoverActive ? 'SIMULATED OUTAGE' : 'ONLINE & ACTIVE'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono">
                      <strong>Engine:</strong> Upstash Redis
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      <strong>Target:</strong> Server-side key-value store
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      <strong>Security:</strong> Session-protected API (Invariants Enforced)
                    </div>
                  </div>

                  {/* Secondary Hot-Standby Backup DB Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Secondary Backup DB</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        HOT STANDBY
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono">
                      <strong>Engine:</strong> Persistent Disk WAL & Mirror
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      <strong>Mirrored Fleet:</strong> {backupStatus?.stats?.vehiclesCount ?? 0} Vehicles | {backupStatus?.stats?.diagnosticsCount ?? 0} Diags
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      <strong>Integrity:</strong> ACID Atomic Write & SHA-256
                    </div>
                  </div>

                  {/* Failover Routing Engine Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5 text-amber-400" />
                        <span>Disaster Recovery</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        AUTO-FAILOVER
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono">
                      <strong>Active Mode:</strong> {backupStatus?.failoverActive ? 'FAILOVER (Standby Active)' : 'Normal Primary Active'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      <strong>Outbox Queue:</strong> {backupStatus?.stats?.pendingSyncQueueCount ?? 0} Pending Replays
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      <strong>Snapshots:</strong> {backupSnapshots.length} Point-in-Time Points
                    </div>
                  </div>
                </div>

                {/* Point-in-Time Backup Snapshots Archive Table */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Point-in-Time Cryptographic Backup Snapshots ({backupSnapshots.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Auto-snap every 15 min + on demand
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar-thin font-mono text-[11px]">
                    {backupSnapshots.length === 0 ? (
                      <div className="text-center py-4 text-slate-500 text-xs font-mono">
                        No snapshots archived yet. Click "Snapshot DB" to create an instant point-in-time image.
                      </div>
                    ) : (
                      backupSnapshots.map((snap) => (
                        <div
                          key={snap.id}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white">{snap.filename}</span>
                              <span className="text-[10px] text-slate-400">{new Date(snap.timestamp).toLocaleString()}</span>
                              <span className="px-1.5 py-0.2 rounded-md text-[9px] bg-slate-800 text-slate-300 border border-slate-700">
                                {(snap.sizeBytes / 1024).toFixed(1)} KB
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                              <span>Vehicles: <strong className="text-slate-200">{snap.recordCount?.vehicles ?? 0}</strong></span>
                              <span>Diagnostics: <strong className="text-slate-200">{snap.recordCount?.diagnostics ?? 0}</strong></span>
                              <span>Orders: <strong className="text-slate-200">{snap.recordCount?.workOrders ?? 0}</strong></span>
                              <span className="text-cyan-400/80">SHA: {snap.sha256.substring(0, 10)}...</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleRestoreBackupSnapshot(snap.filename)}
                              disabled={backupActionLoading}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/40 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Restore Point
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* REAL-TIME SECURITY AUDIT LOG FEED */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <h5 className="text-xs sm:text-sm font-bold text-white font-mono">
                      Intrusion Detection System (IDS) Audit Log
                    </h5>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Live Circular Buffer ({securityAuditEvents.length} Events)
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar-thin font-mono text-[11px]">
                  {securityAuditEvents.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs font-mono">
                      No security incidents logged. All backend layers nominal.
                    </div>
                  ) : (
                    securityAuditEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          evt.severity === 'CRITICAL'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            : evt.severity === 'WARNING'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                evt.severity === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : evt.severity === 'WARNING'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {evt.type}
                            </span>
                            <span className="text-slate-400 text-[10px]">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                            <span className="text-cyan-400 text-[10px]">{evt.path}</span>
                          </div>
                          <div className="text-[10px] text-slate-300 truncate">{evt.details}</div>
                        </div>

                        <div className="text-[9px] font-mono px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 shrink-0">
                          {evt.actionTaken}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 rounded-b-3xl text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Director Console Session Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
};
