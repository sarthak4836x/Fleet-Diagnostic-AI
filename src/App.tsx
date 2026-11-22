import React, { useState, useEffect, useRef } from 'react';
import { fetchCurrentSession, logoutSession } from './data/authCredentials';
import { Header } from './components/Header';
import { TelemetryGauges } from './components/TelemetryGauges';
import { DtcCodeManager } from './components/DtcCodeManager';
import { DiagnosticSummary } from './components/DiagnosticSummary';
import { FuelEfficiencyMonitor } from './components/FuelEfficiencyMonitor';
import { PredictiveMaintenancePanel } from './components/PredictiveMaintenancePanel';
import { WorkOrderModal } from './components/WorkOrderModal';
import { JsonPayloadModal } from './components/JsonPayloadModal';
import { TataMotorsDtcModal } from './components/TataMotorsDtcModal';
import { SensorDefinitionsModal } from './components/SensorDefinitionsModal';
import { TechnicianCopilot } from './components/TechnicianCopilot';
import { MiniMap } from './components/MiniMap';
import { LiveTrackingModal } from './components/LiveTrackingModal';
import { LoginModal } from './components/LoginModal';
import { ObdConnectionModal } from './components/ObdConnectionModal';
import { AddVehicleModal } from './components/AddVehicleModal';
import { FleetRosterPanel } from './components/FleetRosterPanel';
import { DeveloperCommandModal } from './components/DeveloperCommandModal';
import { FleetsModal } from './components/FleetsModal';
import { AddStaffModal } from './components/AddUserForm';
import { VehicleDynamicsHubModal, DynamicsHubTab } from './components/VehicleDynamicsHubModal';
import { useTelemetryAlerts } from './hooks/useTelemetryAlerts';
import { WelcomeLoginScreen } from './components/WelcomeLoginScreen';
import { useBodyScrollLock, unlockBodyScroll } from './hooks/useBodyScrollLock';
import {
  INITIAL_MOCK_SNAPSHOT,
  INITIAL_DIAGNOSTIC_RESULT,
  INITIAL_FUEL_RESULT,
  INITIAL_PREDICTIVE_RESULT,
} from './data/fleetData';
import { EmptyFleetState } from './components/EmptyFleetState';
import {
  FleetLoadState,
  isResultCurrent,
  chooseSelectedVehicle,
  canAddStaff,
  canUseSimulator,
  removeLegacyVehicleCache,
  statusAfterCodeChange,
  diagnosisAfterCodesCleared,
} from './services/fleetView';
import {
  ApiError,
  beginFleetSession,
  clearDiagnosticHistory,
  currentFleetSession,
  describeFleetLoadFailure,
  fetchFleet,
  FleetLoadFailure,
  isStoragePersistent,
  onFleetRefused,
  reportIfFleetRefused,
  saveDiagnostic,
  saveVehicle,
} from './services/fleetApi';
import {
  VehicleSnapshot,
  DiagnosticResult,
  FuelEfficiencyResult,
  PredictiveMaintenanceResult,
  FleetVehicle,
  AuthUser,
  SimCondition,
  VehicleLoadPreset,
} from './types';
import {
  AlertTriangle,
  Radio,
  ShieldAlert,
  Sparkles,
  Layers,
  Activity,
  Fuel,
  CalendarClock,
  Wrench,
  MapPin,
  Navigation,
  Truck,
  Plus,
  Users,
  Play,
  Pause,
} from 'lucide-react';

type AppTab = 'all' | 'diagnostics' | 'fuel' | 'predictive' | 'map' | 'fleet';
const APP_TABS: { id: AppTab; label: string; short: string; icon: React.ComponentType<{ className?: string }>; domId?: string }[] = [
  { id: 'all', label: 'Overview', short: 'Overview', icon: Layers },
  { id: 'diagnostics', label: 'Diagnostics', short: 'Diagnose', icon: Activity },
  { id: 'fuel', label: 'Fuel', short: 'Fuel', icon: Fuel },
  { id: 'predictive', label: 'Service', short: 'Service', icon: CalendarClock, domId: 'tab-maintenance-btn' },
  { id: 'map', label: 'Live Map', short: 'Map', icon: Navigation },
  { id: 'fleet', label: 'Fleet', short: 'Fleet', icon: Truck, domId: 'tab-fleet-units-btn' },
];

const loadInitialUser = (): AuthUser | null => null; // restored from the server session below

export default function App() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [fleetLoad, setFleetLoad] = useState<FleetLoadState>('loading');
  const [fleetLoadFailure, setFleetLoadFailure] = useState<FleetLoadFailure | undefined>(undefined);
  const [fleetReloadTick, setFleetReloadTick] = useState(0);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(loadInitialUser);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [signInNotice, setSignInNotice] = useState<string | undefined>(undefined);

  // Restore an existing server session on page load
  useEffect(() => {
    let cancelled = false;
    fetchCurrentSession().then(({ user, reason }) => {
      if (cancelled) return;
      if (user) setCurrentUser(user);
      else setSignInNotice(reason);
      setIsRestoringSession(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const isLeadDeveloper =
    currentUser?.role === 'developer' ||
    Boolean(currentUser?.permissions?.includes('developer_console') && currentUser?.permissions?.includes('change_code'));
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const canSimulate = canUseSimulator(isLeadDeveloper, currentUser);
  const fleetReady = fleetLoad === 'ready';
  const [currentSnapshot, setCurrentSnapshot] = useState<VehicleSnapshot>(INITIAL_MOCK_SNAPSHOT);
  
  // Custom hook to evaluate active telemetry alerts
  const telemetryAlerts = useTelemetryAlerts(
    fleetReady && selectedVehicleId ? currentSnapshot?.telemetry : undefined,
    currentUser?.isDemoFleet === true
  );

  // Diagnostic states - empty until a vehicle of the signed-in fleet is selected
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [fuelResult, setFuelResult] = useState<FuelEfficiencyResult | null>(null);
  const [predictiveResult, setPredictiveResult] = useState<PredictiveMaintenanceResult | null>(null);

  // Loading states
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isAnalyzingFuel, setIsAnalyzingFuel] = useState(false);
  const [isAnalyzingPredictive, setIsAnalyzingPredictive] = useState(false);

  // UI modes
  const [activeTab, setActiveTab] = useState<AppTab>('all');
  const [isEditable, setIsEditable] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simCondition, setSimCondition] = useState<SimCondition>('hill_climb');
  const [currentGrade, setCurrentGrade] = useState<number>(7.5);
  const [vehicleLoadKg, setVehicleLoadKg] = useState<number>(40000);
  const [loadPreset, setLoadPreset] = useState<VehicleLoadPreset>('rated');
  const [isLoadEmulatorOpen, setIsLoadEmulatorOpen] = useState(false);
  const [isDynamicsHubOpen, setIsDynamicsHubOpen] = useState(false);
  const [dynamicsHubInitialTab, setDynamicsHubInitialTab] = useState<DynamicsHubTab>('load');

  const handleOpenDynamicsHub = (tab: DynamicsHubTab = 'load') => {
    setDynamicsHubInitialTab(tab);
    setIsDynamicsHubOpen(true);
  };
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
  const [isWorkOrderOpen, setIsWorkOrderOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isTataManualOpen, setIsTataManualOpen] = useState(false);
  const [isSensorModalOpen, setIsSensorModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isObdModalOpen, setIsObdModalOpen] = useState(false);
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [isFleetsOpen, setIsFleetsOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isDeveloperConsoleOpen, setIsDeveloperConsoleOpen] = useState(false);
  const [developerConsoleTab, setDeveloperConsoleTab] = useState<any>('obd_scanner');

  const handleOpenDeveloperConsole = (tab: any = 'obd_scanner') => {
    setDeveloperConsoleTab(tab);
    setIsDeveloperConsoleOpen(true);
  };
  const [jsonModalTab, setJsonModalTab] = useState<'input' | 'diagnostics' | 'fuel' | 'predictive' | 'schemas'>('input');
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  const [isGmpQuotaExceeded, setIsGmpQuotaExceeded] = useState(false);

  const vehicleLoadKgRef = useRef<number>(40000);
  // --- CYBERSECURITY: HTTPS Redirect & Inspect Protection ---
  useEffect(() => {
    // 1. Force HTTPS in production
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
      window.location.href = 'https://' + window.location.host + window.location.pathname + window.location.search;
    }

    // 2. Prevent right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    // 3. Prevent DevTools keyboard shortcuts
    const handleKeyDown = (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      // Ctrl+Shift+I / Cmd+Option+I
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
      }
      // Ctrl+Shift+J / Cmd+Option+J
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
      }
      // Ctrl+Shift+C / Cmd+Option+C
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
      }
      // Ctrl+U / Cmd+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    vehicleLoadKgRef.current = vehicleLoadKg;
  }, [vehicleLoadKg]);

  useEffect(() => {
    const quotaHandler = () => setIsGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', quotaHandler);
    return () => window.removeEventListener('gmp-quota-exceeded', quotaHandler);
  }, []);

  const isAnyModalOpen =
    isMiniMapOpen ||
    isWorkOrderOpen ||
    isJsonModalOpen ||
    isTataManualOpen ||
    isSensorModalOpen ||
    isObdModalOpen ||
    isLoginModalOpen ||
    isAddVehicleModalOpen ||
    isFleetsOpen ||
    isAddStaffOpen ||
    isDeveloperConsoleOpen ||
    isLoadEmulatorOpen ||
    isDynamicsHubOpen;

  // Unconditionally ensure background scrolling is unlocked whenever no modals are active
  useEffect(() => {
    if (!isAnyModalOpen) {
      unlockBodyScroll(true);
    }
  }, [isAnyModalOpen]);

  // Simulation timer and driving-cycle tick ref
  const simIntervalRef = useRef<number | null>(null);
  const simTickRef = useRef<number>(0);
  const simPhysicsRef = useRef({
    coolant: 90,
    exhaust: 430,
    rpm: 1380,
    load: 50,
    climbTicks: 0,
    soot: 24.5,
  });

  // Client-side cache to prevent redundant API calls when toggling between vehicles
  const diagCacheRef = useRef<Record<string, DiagnosticResult>>({});
  const fuelCacheRef = useRef<Record<string, FuelEfficiencyResult>>({});
  const predCacheRef = useRef<Record<string, PredictiveMaintenanceResult>>({});

  const [isDbConnected, setIsDbConnected] = useState(false);

  // Bumped whenever the fleet or user changes, so late answers for the old one are dropped
  const sessionEpochRef = useRef(0);

  // Forget everything that belongs to the previous fleet or user
  const clearFleetView = () => {
    sessionEpochRef.current += 1;
    clearDiagnosticHistory();
    isAnalyzingLockRef.current = false;
    setIsDiagnosing(false);
    setIsAnalyzingFuel(false);
    setIsAnalyzingPredictive(false);
    setVehicles([]);
    selectedVehicleIdRef.current = '';
    setSelectedVehicleId('');
    setCurrentSnapshot(INITIAL_MOCK_SNAPSHOT);
    setDiagnosticResult(null);
    setFuelResult(null);
    setPredictiveResult(null);
    setLastAnalyzedAt(null);
    diagCacheRef.current = {};
    fuelCacheRef.current = {};
    predCacheRef.current = {};
  };

  const loadedFleetIdRef = useRef<string | undefined>(undefined);

  // Load only the signed-in fleet from the server
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    if (loadedFleetIdRef.current !== currentUser.fleetId) {
      loadedFleetIdRef.current = currentUser.fleetId;
      clearFleetView();
    }
    setFleetLoad('loading');
    // A refusal or a change of fleet while this load is in flight wins over its answer
    const epoch = sessionEpochRef.current;

    fetchFleet()
      .then((serverVehicles) => {
        if (cancelled || epoch !== sessionEpochRef.current) return;
        setVehicles(serverVehicles);
        const chosen = chooseSelectedVehicle(serverVehicles, selectedVehicleIdRef.current);
        if (chosen) selectVehicleFrom(serverVehicles, chosen);
        setFleetLoad(chosen ? 'ready' : 'empty');
      })
      .catch((err) => {
        if (cancelled || epoch !== sessionEpochRef.current) return;
        console.warn('Could not load the fleet from the server:', err);
        clearFleetView();
        setFleetLoadFailure(describeFleetLoadFailure(err));
        setFleetLoad('error');
      });

    isStoragePersistent().then((persistent) => {
      if (!cancelled) setIsDbConnected(persistent);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser, fleetReloadTick]);

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // The fleet was suspended or removed while the app was open: drop its data and show the refused view
  useEffect(() => {
    return onFleetRefused((message) => {
      if (!currentUserRef.current) return; // nobody is signed in, so there is nothing to refuse
      stopSimulator();
      clearFleetView();
      setIsWorkOrderOpen(false);
      setIsAddVehicleModalOpen(false);
      setIsJsonModalOpen(false);
      setIsMiniMapOpen(false);
      setFleetLoadFailure({ message, canRetry: false, needsSignOut: true });
      setFleetLoad('error');
    });
  }, []);

  /** Posts to an analysis endpoint. A fleet refusal is reported to the app before the failure is thrown. */
  const postAnalysis = async <T,>(url: string, body: unknown): Promise<T> => {
    const epoch = sessionEpochRef.current;
    const fleetSession = currentFleetSession();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      // A refusal for a fleet or user the app has since left must not touch the current one
      if (epoch === sessionEpochRef.current) await reportIfFleetRefused(response, fleetSession);
      throw new Error(`Server returned status ${response.status}`);
    }
    return response.json();
  };

  const selectedVehicleIdRef = useRef('');

  const isAnalyzingLockRef = useRef(false);
  const lastScanTimestampRef = useRef(0);

  const runAllAnalyses = async (snapshot: VehicleSnapshot, force = false) => {
    // Strictly prevent concurrent scan executions or racing loops
    if (isAnalyzingLockRef.current) {
      return;
    }

    const now = Date.now();
    // Enforce throttle: do not trigger auto runs if less than 2.5s elapsed since last scan
    if (now - lastScanTimestampRef.current < 2500 && !force) {
      return;
    }

    const vid = snapshot.vehicle_id;
    // No analysis without a vehicle from the signed-in fleet
    if (!vid || vid !== selectedVehicleIdRef.current) return;
    if (!force && diagCacheRef.current[vid] && fuelCacheRef.current[vid] && predCacheRef.current[vid]) {
      setDiagnosticResult(diagCacheRef.current[vid]);
      setFuelResult(fuelCacheRef.current[vid]);
      setPredictiveResult(predCacheRef.current[vid]);
      return;
    }

    isAnalyzingLockRef.current = true;
    lastScanTimestampRef.current = now;
    try {
      // Run analyses concurrently with Promise.all so all cards update synchronously in a single cycle
      await Promise.all([
        runDiagnostic(snapshot),
        runFuelAnalysis(snapshot),
        runPredictiveAnalysis(snapshot.vehicle_id, snapshot),
      ]);
    } catch (err) {
      console.warn("Diagnostic run error:", err);
    } finally {
      isAnalyzingLockRef.current = false;
    }
  };

  // Keep fresh snapshot reference for automated intervals without stale closures
  const currentSnapshotRef = useRef<VehicleSnapshot>(currentSnapshot);
  useEffect(() => {
    currentSnapshotRef.current = currentSnapshot;
  }, [currentSnapshot]);

  const isDiagnosingRef = useRef(false);
  useEffect(() => {
    isDiagnosingRef.current = isDiagnosing || isAnalyzingFuel || isAnalyzingPredictive;
  }, [isDiagnosing, isAnalyzingFuel, isAnalyzingPredictive]);

  const isSimulatingRef = useRef(isSimulating);
  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  // Scan Now: strictly on-demand execution to fetch fault codes, overall health score, and predictive maintenance
  const handleTriggerScanNow = () => {
    if (isAnalyzingLockRef.current || isDiagnosingRef.current) {
      return;
    }

    const activeSnapshot = currentSnapshotRef.current;
    const currentCodes = activeSnapshot.telemetry.active_dtc_codes || [];

    // Dynamically update DPF Soot Mass value upon clicking Scan Now
    let updatedSoot = activeSnapshot.telemetry.soot_level_g || 18.4;
    const hasDpfFault = currentCodes.some(
      (c) => c === 'P2463' || c.startsWith('P244B') || c === 'P242F'
    );

    if (hasDpfFault) {
      // DPF High Soot fault present: ensure soot is elevated into critical regeneration threshold (>28.5g)
      const delta = Number((Math.random() * 0.8 + 0.4).toFixed(2));
      updatedSoot = Number((Math.max(29.4, updatedSoot) + delta).toFixed(2));
    } else {
      // Real-time sensor sampling delta (+0.7g to +1.6g active accumulation step)
      const delta = Number((Math.random() * 0.9 + 0.7).toFixed(2));
      updatedSoot = Number((updatedSoot + delta).toFixed(2));
      if (updatedSoot > 38.0) {
        // Automatic stationary/highway regeneration cycle resets soot
        updatedSoot = 14.5;
      }
    }

    const updatedSnapshot: VehicleSnapshot = {
      ...activeSnapshot,
      telemetry: {
        ...activeSnapshot.telemetry,
        soot_level_g: updatedSoot,
        active_dtc_codes: [...currentCodes],
      },
    };

    // Synchronize snapshot reference and simulation physics
    currentSnapshotRef.current = updatedSnapshot;
    setCurrentSnapshot(updatedSnapshot);
    simPhysicsRef.current.soot = updatedSoot;

    // Synchronize vehicle in the fleet array so all views update
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.vehicle_id === updatedSnapshot.vehicle_id) {
          return {
            ...v,
            telemetry: {
              ...v.telemetry,
              soot_level_g: updatedSoot,
              active_dtc_codes: [...currentCodes],
            },
          };
        }
        return v;
      })
    );

    // Invalidate caches to guarantee fresh scan results reflecting new soot mass and DTCs
    delete diagCacheRef.current[updatedSnapshot.vehicle_id];
    delete fuelCacheRef.current[updatedSnapshot.vehicle_id];
    delete predCacheRef.current[updatedSnapshot.vehicle_id];

    // Trigger AI & diagnostic scan pipelines
    runAllAnalyses(updatedSnapshot, true);
  };

  const selectVehicleFrom = (list: FleetVehicle[], vehicleId: string) => {
    const found = list.find((v) => v.vehicle_id === vehicleId);
    if (!found) return;
    selectedVehicleIdRef.current = vehicleId;
    setSelectedVehicleId(vehicleId);
    const snapshot: VehicleSnapshot = {
      vehicle_id: found.vehicle_id,
      engine_hours: found.engine_hours,
      telemetry: { ...found.telemetry },
    };
    currentSnapshotRef.current = snapshot;
    setCurrentSnapshot(snapshot);
    // The baseline results belong to the sample truck, so only a demo fleet may start from them
    const isDemoBaseline = Boolean(currentUser?.isDemoFleet) && vehicleId === INITIAL_MOCK_SNAPSHOT.vehicle_id;
    if (isDemoBaseline) {
      diagCacheRef.current[vehicleId] ??= INITIAL_DIAGNOSTIC_RESULT;
      fuelCacheRef.current[vehicleId] ??= INITIAL_FUEL_RESULT;
      predCacheRef.current[vehicleId] ??= INITIAL_PREDICTIVE_RESULT;
    }
    // Show this vehicle's own results, or none; never the previous vehicle's
    setDiagnosticResult(diagCacheRef.current[vehicleId] ?? null);
    setFuelResult(fuelCacheRef.current[vehicleId] ?? null);
    setPredictiveResult(predCacheRef.current[vehicleId] ?? null);
    setLastAnalyzedAt(isDemoBaseline ? 'Baseline Ready' : null);
  };

  // Handle vehicle switch
  const handleSelectVehicle = (vehicleId: string) => selectVehicleFrom(vehicles, vehicleId);

  // Add new vehicle to fleet
  const handleAddVehicle = async (newVehicle: FleetVehicle) => {
    // The server must have the vehicle before anything is analysed or shown as added
    const epoch = sessionEpochRef.current;
    try {
      await saveVehicle(newVehicle);
    } catch (err) {
      console.warn('Could not save the vehicle on the server:', err);
      throw new Error(
        err instanceof ApiError ? err.message : 'The vehicle could not be saved on the server. Check your connection and try again.'
      );
    }
    if (epoch !== sessionEpochRef.current) return;
    // A failed load left the list empty, so fetch the whole fleet rather than show one vehicle as if it were all of it
    if (fleetLoad === 'error') {
      selectedVehicleIdRef.current = newVehicle.vehicle_id;
      setFleetReloadTick((t) => t + 1);
      setIsAddVehicleModalOpen(false);
      return;
    }
    setVehicles((prev) => {
      const filtered = prev.filter((v) => v.vehicle_id !== newVehicle.vehicle_id);
      return [newVehicle, ...filtered];
    });

    // Automatically inspect the newly added vehicle
    selectedVehicleIdRef.current = newVehicle.vehicle_id;
    setSelectedVehicleId(newVehicle.vehicle_id);
    setDiagnosticResult(null);
    setFuelResult(null);
    setPredictiveResult(null);
    setLastAnalyzedAt(null);
    setFleetLoad('ready');
    const snapshot: VehicleSnapshot = {
      vehicle_id: newVehicle.vehicle_id,
      engine_hours: newVehicle.engine_hours,
      telemetry: { ...newVehicle.telemetry },
    };
    currentSnapshotRef.current = snapshot;
    setCurrentSnapshot(snapshot);
    runAllAnalyses(snapshot, true);
    setIsAddVehicleModalOpen(false);
  };

  // User session management
  // The session itself lives in an HttpOnly cookie set by the server; we only keep the
  // public profile in React state (never in localStorage).
  const stopSimulator = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimulating(false);
  };

  // A fleet that is not a demo must never run made-up telemetry, however the fleet changed
  useEffect(() => {
    if (!canSimulate && isSimulating) stopSimulator();
  }, [canSimulate, isSimulating]);

  const handleLoginUser = (user: AuthUser) => {
    beginFleetSession();
    setSignInNotice(undefined);
    // Switching to a different user is a sign-out followed by a sign-in: nothing may carry over
    if (currentUser && (currentUser.id !== user.id || currentUser.fleetId !== user.fleetId)) {
      loadedFleetIdRef.current = user.fleetId ?? '';
      stopSimulator();
      clearFleetView();
      setFleetLoad('loading');
    }
    setCurrentUser(user);
    removeLegacyVehicleCache();
    try {
      localStorage.removeItem('fleetdiag_user'); // clean up data written by older versions
    } catch {
      // ignore
    }
  };

  const handleLogoutUser = () => {
    beginFleetSession();
    setCurrentUser(null);
    removeLegacyVehicleCache();
    loadedFleetIdRef.current = undefined;
    clearFleetView();
    setFleetLoad('loading');
    stopSimulator();
    void logoutSession();
  };

  // 1. Run General AI Diagnostic
  const runDiagnostic = async (snapshotToDiagnose?: VehicleSnapshot) => {
    const payload = snapshotToDiagnose || currentSnapshot;
    const epoch = sessionEpochRef.current;
    setIsDiagnosing(true);

    try {
      const data = await postAnalysis<DiagnosticResult>('/api/diagnose', payload);
      if (!isResultCurrent(epoch, sessionEpochRef.current, payload.vehicle_id, selectedVehicleIdRef.current)) return;
      setDiagnosticResult(data);
      if (payload.vehicle_id) {
        diagCacheRef.current[payload.vehicle_id] = data;
        if (currentUser) {
          saveDiagnostic(payload.vehicle_id, data).catch((err) => {
            console.warn('Could not save the diagnostic on the server:', err);
          });
        }
      }
      setLastAnalyzedAt(new Date().toLocaleTimeString());
    } catch {
      // Handled silently with fallback telemetry
    } finally {
      if (epoch === sessionEpochRef.current) setIsDiagnosing(false);
    }
  };

  // 2. Run Fuel Efficiency Analysis
  const runFuelAnalysis = async (snapshotToDiagnose?: VehicleSnapshot) => {
    const payload = snapshotToDiagnose || currentSnapshot;
    const epoch = sessionEpochRef.current;
    setIsAnalyzingFuel(true);

    try {
      const data = await postAnalysis<FuelEfficiencyResult>('/api/fuel-efficiency', payload);
      if (!isResultCurrent(epoch, sessionEpochRef.current, payload.vehicle_id, selectedVehicleIdRef.current)) return;
      setFuelResult(data);
      if (payload.vehicle_id) {
        fuelCacheRef.current[payload.vehicle_id] = data;
      }
    } catch {
      // Handled silently
    } finally {
      if (epoch === sessionEpochRef.current) setIsAnalyzingFuel(false);
    }
  };

  // 3. Run Predictive Maintenance Analysis
  const runPredictiveAnalysis = async (vehicleId?: string, snapshotToDiagnose?: VehicleSnapshot) => {
    const targetId = vehicleId || selectedVehicleId;
    const found = vehicles.find((v) => v.vehicle_id === targetId);
    const activeSnapshot = snapshotToDiagnose || currentSnapshot;
    const epoch = sessionEpochRef.current;
    setIsAnalyzingPredictive(true);

    try {
      const data = await postAnalysis<PredictiveMaintenanceResult>('/api/predictive-maintenance', {
        vehicle_id: targetId,
        history: found?.history || [],
        snapshot: activeSnapshot,
      });
      if (!isResultCurrent(epoch, sessionEpochRef.current, targetId, selectedVehicleIdRef.current)) return;
      setPredictiveResult(data);
      if (targetId) {
        predCacheRef.current[targetId] = data;
      }
    } catch {
      // Handled silently
    } finally {
      if (epoch === sessionEpochRef.current) setIsAnalyzingPredictive(false);
    }
  };

  // Toggle Live Streaming Simulation: sends mimicking data of vehicle to the scanner and live tracking
  const toggleSimulation = (forceState?: boolean) => {
    // Strictly restricted to developer users only
    if (!canSimulate) {
      return;
    }
    const nextState = typeof forceState === 'boolean' ? forceState : !isSimulating;
    if (!nextState) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      setIsSimulating(false);
      // Unlinked from scanMode: User's chosen scan mode remains untouched
    } else {
      // When OBD stream comes alive, reset/initialize physics state for the active condition
      simPhysicsRef.current.climbTicks = 0;
      simPhysicsRef.current.coolant = currentSnapshot.telemetry.coolant_temp_c || 90;
      simPhysicsRef.current.rpm = currentSnapshot.telemetry.engine_rpm || 1350;
      if (simCondition === 'hill_climb') {
        setCurrentGrade(7.5);
      } else if (simCondition === 'overheat') {
        setCurrentGrade(6.0);
      } else {
        setCurrentGrade(0.0);
      }
      setIsSimulating(true);
      // Unlinked from scanMode: Live button strictly sends mimicking data of vehicle to the scanner; Scan Now remains manual
    }
  };

  // Effect for running the live autonomous telematics simulation with real-world powertrain conditions
  useEffect(() => {
    if (!isSimulating) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      return;
    }

    simIntervalRef.current = window.setInterval(() => {
      simTickRef.current += 1;
      const tick = simTickRef.current;
      const phys = simPhysicsRef.current;

      let baseSpeed = 70;
      let baseRpm = 1380;
      let baseLoad = 52;
      let baseCoolant = phys.coolant;
      let baseVolt = 27.8;
      let baseNox = 95;
      let baseExhaust = phys.exhaust;
      let baseKml = 4.3;

      if (simCondition === 'hill_climb') {
        // Prolonged heavy mountain pass haul: transmission downshifts, RPM climbs, and coolant temperature continuously rises
        phys.climbTicks += 1;
        const progress = Math.min(1, phys.climbTicks / 10);

        // Grade ramps into steep commercial incline (+4.5% up to +7.8%)
        const activeGrade = Number((4.5 + progress * 3.3).toFixed(1));
        setCurrentGrade(activeGrade);

        // Downshifting into direct gears under steep grade resistance:
        // RPM climbs progressively from ~1380 up to ~1950 - 2120 RPM (exceeding 1500 RPM optimal threshold)!
        const targetRpm = 1680 + Math.round(progress * 360) + Math.round(Math.sin(tick * 0.7) * 85);
        baseRpm = Math.min(2200, targetRpm);

        // Engine Load is heavy haul torque (80% to 94%)
        baseLoad = Math.min(96, Math.round(78 + progress * 14 + Math.sin(tick * 0.5) * 3));

        // Vehicle speed drops slightly under heavy uphill resistance (72 down to 58-64 km/h)
        baseSpeed = Math.max(54, Math.round(72 - progress * 12 + Math.sin(tick * 0.4) * 2));

        // Coolant temperature starts rising continuously under intense diesel combustion!
        // Rises step-by-step from 90°C up towards 103-105°C
        phys.coolant = Math.min(104, Number((phys.coolant + 0.45).toFixed(1)));
        baseCoolant = Math.round(phys.coolant);

        // Pyrometer / EGT rises with sustained hill torque
        phys.exhaust = Math.min(575, Math.round(440 + progress * 125 + Math.sin(tick * 0.6) * 12));
        baseExhaust = phys.exhaust;

        // Peak combustion temperatures elevate NOx output
        baseNox = Math.round(155 + progress * 75 + Math.sin(tick * 0.5) * 15);

        // Instant fuel economy drops under grade incline haul
        baseKml = Number(Math.max(2.4, 3.6 - progress * 0.8).toFixed(2));
      } else if (simCondition === 'cruise') {
        // Optimal highway cruise on flat terrain: temperatures stabilize, RPM in green zone
        setCurrentGrade(0.0);
        baseSpeed = Math.round(71 + Math.sin(tick * 0.3) * 3);
        baseRpm = Math.round(1360 + Math.sin(tick * 0.4) * 55);
        baseLoad = Math.round(48 + Math.cos(tick * 0.5) * 6);
        if (phys.coolant > 89) {
          phys.coolant = Number((phys.coolant - 0.35).toFixed(1));
        } else {
          phys.coolant = 89;
        }
        baseCoolant = Math.round(phys.coolant);
        phys.exhaust = Math.max(410, phys.exhaust - 3);
        baseExhaust = phys.exhaust;
        baseNox = 92;
        baseKml = 4.4;
      } else if (simCondition === 'dpf_regen') {
        setCurrentGrade(0.0);
        baseRpm = Math.round(2500 + Math.sin(tick * 0.8) * 35);
        baseSpeed = 0;
        baseLoad = Math.round(85 + Math.sin(tick * 0.5) * 5);
        
        phys.coolant = Math.min(96, Number((phys.coolant + 0.15).toFixed(1)));
        baseCoolant = Math.round(phys.coolant);
        
        phys.exhaust = Math.min(680, Math.round(480 + (phys.climbTicks * 8) + Math.sin(tick * 0.6) * 12));
        baseExhaust = phys.exhaust;
        
        baseNox = 180;
        baseKml = 0.5;
        phys.climbTicks += 1;
      } else if (simCondition === 'overheat') {
        // Thermal stress runaway condition
        setCurrentGrade(6.0);
        baseRpm = Math.round(1760 + Math.sin(tick * 0.6) * 120);
        baseLoad = 88;
        baseSpeed = 62;
        phys.coolant = Math.min(115, Number((phys.coolant + 0.8).toFixed(1)));
        baseCoolant = Math.round(phys.coolant);
        baseExhaust = 585;
        baseNox = 210;
        baseKml = 2.9;
      } else if (simCondition === 'traffic') {
        // Urban congestion stop & go
        setCurrentGrade(0.0);
        const trafficPhase = tick % 16;
        if (trafficPhase < 6) {
          baseSpeed = 0;
          baseRpm = 680;
          baseLoad = 18;
          baseKml = 0.5;
        } else if (trafficPhase < 12) {
          baseSpeed = 22;
          baseRpm = 1150;
          baseLoad = 62;
          baseKml = 2.4;
        } else {
          baseSpeed = 34;
          baseRpm = 1520;
          baseLoad = 75;
          baseKml = 2.8;
        }
        if (phys.coolant < 96) {
          phys.coolant = Number((phys.coolant + 0.2).toFixed(1));
        }
        baseCoolant = Math.round(phys.coolant);
        baseExhaust = 380;
        baseNox = 115;
      } else {
        // Route Cycle: autonomous 36-step rolling route alternating between climbs, crests, and flats
        const step = tick % 36;
        if (step >= 14 && step <= 26) {
          const climbProgress = (step - 14) / 12;
          setCurrentGrade(Number((2.0 + climbProgress * 5.8).toFixed(1)));
          baseRpm = Math.round(1550 + Math.sin(climbProgress * Math.PI) * 420);
          baseSpeed = Math.round(72 - climbProgress * 10);
          baseLoad = Math.round(74 + climbProgress * 18);
          phys.coolant = Math.min(103, Number((phys.coolant + 0.45).toFixed(1)));
          baseCoolant = Math.round(phys.coolant);
          baseExhaust = Math.round(460 + climbProgress * 95);
          baseNox = Math.round(160 + climbProgress * 80);
          baseKml = Number((3.5 - climbProgress * 0.7).toFixed(2));
        } else if (step >= 27 && step <= 31) {
          setCurrentGrade(-1.5);
          baseRpm = 1320;
          baseSpeed = 68;
          baseLoad = 32;
          phys.coolant = Number((phys.coolant - 0.3).toFixed(1));
          baseCoolant = Math.round(phys.coolant);
          baseExhaust = 420;
          baseNox = 90;
          baseKml = 5.2;
        } else {
          setCurrentGrade(0.0);
          baseRpm = Math.round(1360 + Math.sin(step * 0.4) * 45);
          baseSpeed = Math.round(72 + Math.sin(step * 0.3) * 3);
          baseLoad = Math.round(50 + Math.cos(step * 0.5) * 6);
          if (phys.coolant > 89) phys.coolant = Number((phys.coolant - 0.3).toFixed(1));
          baseCoolant = Math.round(phys.coolant);
          baseExhaust = 430;
          baseNox = 95;
          baseKml = 4.4;
        }
      }

      // Dynamic Vehicle Load (GVW & Payload) physics influence
      const currentLoadKg = vehicleLoadKgRef.current || 40000;
      const loadWeightFactor = currentLoadKg / 40000;
      // Adjust base engine load: lighter payload reduces load, overload increases load
      baseLoad = Math.min(100, Math.max(12, Math.round(baseLoad * (0.76 + loadWeightFactor * 0.24))));
      // Adjust instant fuel economy: lighter payload improves KMPL, overload penalizes KMPL
      baseKml = Number(Math.max(1.8, (baseKml / (0.78 + loadWeightFactor * 0.22))).toFixed(2));
      // Tire pressure slightly rises under extreme cargo load deflection
      const tireLoadBoost = currentLoadKg > 40000 ? ((currentLoadKg - 40000) / 10000) * 1.5 : 0;

      // Add realistic micro-sensor jitter
      const rpmJitter = Math.floor(Math.random() * 16) - 8;
      const speedJitter = Math.floor(Math.random() * 3) - 1;
      const voltJitter = Number((Math.random() * 0.2 - 0.1).toFixed(1));
      const loadJitter = Math.floor(Math.random() * 4) - 2;

      const simSpeed = Math.max(0, Math.min(85, baseSpeed + speedJitter));
      const simRpm = Math.max(600, Math.min(2200, baseRpm + rpmJitter));
      // Wheel RPM derived from speed: rev/min = (speed_kmh * 1000) / (60 * 2 * PI * rolling_radius_0.525m)
      const simWheelRpm = Math.round((simSpeed * 1000) / (60 * 2 * Math.PI * 0.525));
      const simLoad = Math.max(10, Math.min(100, baseLoad + loadJitter));
      const simVolt = Number(Math.max(20, Math.min(30, baseVolt + voltJitter)).toFixed(1));
      const simFuelRate = Number(((simRpm / 1000) * (simLoad / 100) * 26 + 3.5).toFixed(1));
      const simTirePsi = Number((106.5 + tireLoadBoost + Math.sin(tick * 0.2) * 1.2).toFixed(1));

      // Torque measurement (SAE J1939 EEC1 SPN 513)
      const hasDtcDerate = Boolean(currentSnapshot.telemetry.active_dtc_codes && currentSnapshot.telemetry.active_dtc_codes.length > 0);
      const torqueDeratePct = hasDtcDerate ? 25 : 0;
      const effectiveTorquePct = Math.min(100, Math.max(12, Math.round(simLoad * (1 - torqueDeratePct / 100))));
      const simTorqueNm = Math.round((effectiveTorquePct / 100) * 1100);

      setCurrentSnapshot((prev) => {
        const updatedTelemetry = {
          ...prev.telemetry,
          speed_kmh: simSpeed,
          speed_mph: Math.round(simSpeed / 1.60934),
          engine_rpm: simRpm,
          wheel_rpm: simWheelRpm,
          actual_torque_nm: simTorqueNm,
          torque_pct: effectiveTorquePct,
          torque_derate_pct: torqueDeratePct,
          tire_pressure_psi: simTirePsi,
          engine_load_pct: simLoad,
          coolant_temp_c: baseCoolant,
          battery_voltage_v: simVolt,
          fuel_rate_lph: simFuelRate,
          fuel_rate_gph: Number((simFuelRate * 0.264172).toFixed(1)),
          instant_kml: baseKml,
          instant_mpg: Number((baseKml * 2.35215).toFixed(2)),
          exhaust_temp_c: baseExhaust,
          nox_sensor_ppm: baseNox,
          soot_level_g: Number(simPhysicsRef.current.soot.toFixed(2)),
        };
        return {
          ...prev,
          telemetry: updatedTelemetry,
        };
      });

      // Subtly advance live GPS position along the highway corridor and sync dynamic telemetry
      setVehicles((prevVehicles) =>
        prevVehicles.map((v) => {
          if (v.vehicle_id === selectedVehicleId) {
            const headingRad = ((v.coordinates?.heading || 0) * Math.PI) / 180;
            const delta = simSpeed > 0 ? 0.00006 : 0;
            return {
              ...v,
              telemetry: {
                ...v.telemetry,
                speed_kmh: simSpeed,
                speed_mph: Math.round(simSpeed / 1.60934),
                engine_rpm: simRpm,
                wheel_rpm: simWheelRpm,
                actual_torque_nm: simTorqueNm,
                torque_pct: effectiveTorquePct,
                torque_derate_pct: torqueDeratePct,
                tire_pressure_psi: simTirePsi,
                engine_load_pct: simLoad,
                coolant_temp_c: baseCoolant,
                battery_voltage_v: simVolt,
                fuel_rate_lph: simFuelRate,
                fuel_rate_gph: Number((simFuelRate * 0.264172).toFixed(1)),
                instant_kml: baseKml,
                instant_mpg: Number((baseKml * 2.35215).toFixed(2)),
                exhaust_temp_c: baseExhaust,
                nox_sensor_ppm: baseNox,
                soot_level_g: Number(simPhysicsRef.current.soot.toFixed(2)),
              },
              coordinates: v.coordinates ? {
                ...v.coordinates,
                lat: Number((v.coordinates.lat + Math.cos(headingRad) * delta).toFixed(5)),
                lng: Number((v.coordinates.lng + Math.sin(headingRad) * delta).toFixed(5)),
              } : v.coordinates,
            };
          }
          return v;
        })
      );
    }, 1400);

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isSimulating, selectedVehicleId, simCondition]);

  // Update telemetry fields from sliders/buttons/developer console
  const handleUpdateTelemetry = (newTelemetry: any) => {
    let updatedSnapshot: VehicleSnapshot;
    setCurrentSnapshot((prev) => {
      const updatedTelemetry = {
        ...prev.telemetry,
        ...newTelemetry,
      };
      updatedSnapshot = {
        ...prev,
        telemetry: updatedTelemetry,
      };
      currentSnapshotRef.current = updatedSnapshot;
      return updatedSnapshot;
    });

    const targetVehicleId = currentSnapshotRef.current.vehicle_id;
    const isDemoFleet = currentUser?.isDemoFleet === true;

    // Synchronize vehicle in the fleet array so injected codes and overrides stay persistent
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.vehicle_id === targetVehicleId) {
          const hasCodes = newTelemetry.active_dtc_codes !== undefined
            ? newTelemetry.active_dtc_codes.length > 0
            : (v.telemetry.active_dtc_codes && v.telemetry.active_dtc_codes.length > 0);
          return {
            ...v,
            status: statusAfterCodeChange(v.status, Boolean(hasCodes), isDemoFleet),
            telemetry: {
              ...v.telemetry,
              ...newTelemetry,
            },
          };
        }
        return v;
      })
    );

    // Invalidate caches so clicking Scan Now triggers a fresh scan for this vehicle
    delete diagCacheRef.current[targetVehicleId];
    delete fuelCacheRef.current[targetVehicleId];
    delete predCacheRef.current[targetVehicleId];

    // Once every code is cleared, the old diagnosis no longer applies. A demo fleet shows a
    // ready-made "codes cleared" result; a real fleet shows none until it is scanned again.
    if (newTelemetry.active_dtc_codes && newTelemetry.active_dtc_codes.length === 0) {
      setDiagnosticResult(diagnosisAfterCodesCleared(isDemoFleet, new Date().toISOString()));
    }
  };

  // Update active DTC codes with instant vehicle status & diagnostic clearing
  const handleUpdateCodes = (newCodes: string[]) => {
    handleUpdateTelemetry({ active_dtc_codes: newCodes });
  };

  // Reset to prompt benchmark
  const handleResetBenchmark = () => {
    if (!currentUser?.isDemoFleet) return;
    selectVehicleFrom(vehicles, INITIAL_MOCK_SNAPSHOT.vehicle_id);
    // the vehicle may have been edited; go back to the benchmark values
    currentSnapshotRef.current = INITIAL_MOCK_SNAPSHOT;
    setCurrentSnapshot(INITIAL_MOCK_SNAPSHOT);
    runAllAnalyses(INITIAL_MOCK_SNAPSHOT);
  };

  // Load custom json from payload modal
  const handleLoadCustomJson = (customSnapshot: VehicleSnapshot) => {
    setCurrentSnapshot(customSnapshot);
    selectedVehicleIdRef.current = customSnapshot.vehicle_id;
    setSelectedVehicleId(customSnapshot.vehicle_id);
    runAllAnalyses(customSnapshot);
  };

  const openJsonTab = (tab: 'input' | 'diagnostics' | 'fuel' | 'predictive' | 'schemas') => {
    setJsonModalTab(tab);
    setIsJsonModalOpen(true);
  };

  const currentVehicleMeta = vehicles.find((v) => v.vehicle_id === currentSnapshot.vehicle_id);
  // "Tata Prima 5530.S (Cummins ISBe 6.7L BSVI 300HP)" -> short title + spec line, so the title never wraps
  const makeModel = currentVehicleMeta?.make_model || 'Heavy-duty commercial vehicle';
  const specStart = makeModel.indexOf(' (');
  const vehicleTitle = specStart > 0 ? makeModel.slice(0, specStart) : makeModel;
  const vehicleSpec = specStart > 0 ? makeModel.slice(specStart + 2).replace(/\)$/, '') : '';

  if (isRestoringSession && !currentUser) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center" aria-busy="true">
        <span className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // When logged out, require operator authentication via the Welcome Screen
  if (!currentUser) {
    return <WelcomeLoginScreen onLogin={handleLoginUser} notice={signInNotice} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-400 selection:text-slate-950">
      {/* Google Maps Platform Demo Quota Banner */}
      {isGmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Primary App Bar */}
      <Header
        alerts={telemetryAlerts}
        vehicles={vehicles}
        currentVehicleId={selectedVehicleId}
        onSelectVehicle={handleSelectVehicle}
        status={diagnosticResult?.status}
        isDiagnosing={isDiagnosing || isAnalyzingFuel || isAnalyzingPredictive}
        onRunDiagnostics={handleTriggerScanNow}
        isSimulating={isSimulating}
        onToggleSimulation={toggleSimulation}
        canSimulate={canSimulate}
        simCondition={simCondition}
        onSelectSimCondition={setSimCondition}
        gradePct={currentGrade}
        onOpenWorkOrder={() => setIsWorkOrderOpen(true)}
        onOpenJsonView={() => openJsonTab('input')}
        onOpenTataManual={() => setIsTataManualOpen(true)}
        onOpenSensorDefinitions={() => setIsSensorModalOpen(true)}
        isMiniMapOpen={isMiniMapOpen}
        onToggleMiniMap={() => setIsMiniMapOpen(!isMiniMapOpen)}
        onOpenAddVehicle={() => setIsAddVehicleModalOpen(true)}
        currentUser={currentUser}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogoutUser}
        onOpenObdReader={() => setIsObdModalOpen(true)}
        isDbConnected={isDbConnected}
        onOpenDeveloperConsole={isLeadDeveloper ? (tab = 'obd_scanner') => handleOpenDeveloperConsole(tab) : undefined}
        onOpenFleets={() => setIsFleetsOpen(true)}
        onOpenAddStaff={canAddStaff(currentUser) ? () => setIsAddStaffOpen(true) : undefined}
        vehicleLoadKg={vehicleLoadKg}
        onOpenLoadEmulator={() => handleOpenDynamicsHub('load')}
        onOpenDynamicsHub={handleOpenDynamicsHub}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-[1760px] mx-auto w-full min-w-0 px-4 lg:px-8 pt-3 pb-28 md:pb-12 space-y-5 sm:space-y-6">
        {!fleetReady ? (
          <EmptyFleetState
            state={fleetLoad}
            onAddVehicle={() => setIsAddVehicleModalOpen(true)}
            onRetry={() => setFleetReloadTick((t) => t + 1)}
            onSignOut={handleLogoutUser}
            failure={fleetLoadFailure}
          />
        ) : (
        <>
        {/* Vehicle title: name on the left, key figures aligned to the right edge of the cards */}
        <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pt-2 sm:pt-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
              {currentSnapshot.vehicle_id}
            </p>
            <h1 className="mt-1 text-[28px] sm:text-[34px] leading-tight font-semibold tracking-tight text-white truncate">
              {vehicleTitle}
            </h1>
            <p className="mt-1 text-[14px] sm:text-[15px] text-slate-400">
              {[vehicleSpec, currentVehicleMeta?.location].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className="grid grid-cols-[auto_auto_1fr] xl:flex gap-2 shrink-0">
            <div className="hero-stat">
              <span className="hero-stat-label">Engine</span>
              <span className="hero-stat-value">{currentSnapshot.engine_hours.toLocaleString()} h</span>
            </div>
            <button
              id="status-bar-load-emulator-btn"
              onClick={() => handleOpenDynamicsHub('load')}
              className="hero-stat hover:bg-slate-800 transition-colors"
              title="Open load & dynamics"
            >
              <span className="hero-stat-label">Load</span>
              <span className={`hero-stat-value ${vehicleLoadKg > 40000 ? '!text-rose-400' : ''}`}>
                {(vehicleLoadKg / 1000).toFixed(1)} t{vehicleLoadKg > 40000 ? ' · over' : ''}
              </span>
            </button>
            {isSimulating && (
              <button
                id="status-bar-inclinometer-btn"
                onClick={() => handleOpenDynamicsHub('profile')}
                className="hero-stat hover:bg-slate-800 transition-colors order-last xl:order-none col-span-3"
                title="Change driving profile"
              >
                <span className="hero-stat-label">Route</span>
                <span className="hero-stat-value">
                  {simCondition === 'hill_climb' && `Hill climb +${currentGrade}%`}
                  {simCondition === 'cruise' && 'Flat cruise'}
                  {simCondition === 'overheat' && 'Overheat stress'}
                  {simCondition === 'traffic' && 'Stop & go'}
                  {simCondition === 'route_cycle' && 'Route cycle'}
                </span>
              </button>
            )}
            {lastAnalyzedAt && (
              <div className="hero-stat">
                <span className="hero-stat-label">Last scan</span>
                <span className="hero-stat-value">{lastAnalyzedAt}</span>
              </div>
            )}
          </div>
        </section>

        {/* Desktop / tablet: segmented control */}
        <nav className="hidden md:block sticky top-14 z-40 py-2" aria-label="Sections">
          <div className="apple-segmented apple-toolbar !border-0" role="tablist">
            {APP_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  id={t.domId}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.id === 'fleet' ? `${t.label} (${vehicles.length})` : t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* TAB 1: ALL SYSTEMS OVERVIEW */}
        {activeTab === 'all' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
            {/* Real-Time Powertrain, Emissions, Speed, TPMS & Tachometer (Engine & Wheels RPM) Cluster on TOP */}
            <div className="lg:col-span-12 min-w-0">
            <TelemetryGauges
              telemetry={currentSnapshot.telemetry}
              onChangeTelemetry={handleUpdateTelemetry}
              isEditable={isEditable}
              onToggleEditable={() => setIsEditable(!isEditable)}
              onResetBenchmark={currentUser?.isDemoFleet ? handleResetBenchmark : undefined}
              onOpenSensorDefinitions={() => setIsSensorModalOpen(true)}
              isSimulating={isSimulating}
              simCondition={simCondition}
              onSelectSimCondition={setSimCondition}
              gradePct={currentGrade}
            />
            </div>

            {/* Primary Diagnostic Assessment */}
            <div className="lg:col-span-12 min-w-0">
            <DiagnosticSummary
              result={diagnosticResult}
              snapshot={currentSnapshot}
              isLoading={isDiagnosing}
              onOpenWorkOrder={() => setIsWorkOrderOpen(true)}
            />
            </div>

            {/* Fuel Efficiency Monitor Summary (Equal 6-col balanced grid with Maintenance) */}
            <div className="lg:col-span-12 xl:col-span-6 flex flex-col min-w-0">
            <FuelEfficiencyMonitor
              snapshot={currentSnapshot}
              fuelResult={fuelResult}
              isLoading={isAnalyzingFuel}
              onAnalyzeFuel={() => runFuelAnalysis(currentSnapshot)}
              onViewJson={() => openJsonTab('fuel')}
              isEditable={isEditable}
              onChangeTelemetry={handleUpdateTelemetry}
            />
            </div>

            {/* Predictive Maintenance & Recurring Trends (Equal 6-col balanced grid) */}
            <div className="lg:col-span-12 xl:col-span-6 flex flex-col min-w-0">
            <PredictiveMaintenancePanel
              snapshot={currentSnapshot}
              vehicleMeta={currentVehicleMeta}
              predictiveResult={predictiveResult}
              isLoading={isAnalyzingPredictive}
              onAnalyzePredictive={() => runPredictiveAnalysis(selectedVehicleId, currentSnapshot)}
              onViewJson={() => openJsonTab('predictive')}
            />
            </div>

          </div>
        )}

        {/* TAB 2: DIAGNOSTICS & DTCS */}
        {activeTab === 'diagnostics' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
            {/* Real-Time Powertrain, Emissions, Speed, TPMS & Tachometer Cluster on TOP */}
            <div className="lg:col-span-12 min-w-0">
            <TelemetryGauges
              telemetry={currentSnapshot.telemetry}
              onChangeTelemetry={handleUpdateTelemetry}
              isEditable={isEditable}
              onToggleEditable={() => setIsEditable(!isEditable)}
              onResetBenchmark={currentUser?.isDemoFleet ? handleResetBenchmark : undefined}
              onOpenSensorDefinitions={() => setIsSensorModalOpen(true)}
              isSimulating={isSimulating}
              simCondition={simCondition}
              onSelectSimCondition={setSimCondition}
              gradePct={currentGrade}
            />
            </div>

            <div className="lg:col-span-12 min-w-0">
            <DiagnosticSummary
              result={diagnosticResult}
              snapshot={currentSnapshot}
              isLoading={isDiagnosing}
              onOpenWorkOrder={() => setIsWorkOrderOpen(true)}
            />
            </div>

            <div className="lg:col-span-7">
              <DtcCodeManager
                  activeCodes={currentSnapshot.telemetry.active_dtc_codes}
                  onChangeCodes={handleUpdateCodes}
                />
            </div>
            <div className="lg:col-span-5">
              <TechnicianCopilot
                snapshot={currentSnapshot}
                result={diagnosticResult}
              />
            </div>
          </div>
        )}

        {/* TAB 3: FUEL EFFICIENCY & DYNAMICS */}
        {activeTab === 'fuel' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
            <div className="lg:col-span-12 min-w-0">
            <FuelEfficiencyMonitor
              snapshot={currentSnapshot}
              fuelResult={fuelResult}
              isLoading={isAnalyzingFuel}
              onAnalyzeFuel={() => runFuelAnalysis(currentSnapshot)}
              onViewJson={() => openJsonTab('fuel')}
            />
            </div>

            <div className="lg:col-span-12 min-w-0">
            <TelemetryGauges
              telemetry={currentSnapshot.telemetry}
              onChangeTelemetry={handleUpdateTelemetry}
              isEditable={isEditable}
              onToggleEditable={() => setIsEditable(!isEditable)}
              onResetBenchmark={currentUser?.isDemoFleet ? handleResetBenchmark : undefined}
              onOpenSensorDefinitions={() => setIsSensorModalOpen(true)}
              isSimulating={isSimulating}
              simCondition={simCondition}
              onSelectSimCondition={setSimCondition}
              gradePct={currentGrade}
            />
            </div>
          </div>
        )}

        {/* TAB 4: PREDICTIVE MAINTENANCE & 90-DAY TRENDS */}
        {activeTab === 'predictive' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
            <div className="lg:col-span-12 min-w-0">
            <PredictiveMaintenancePanel
              snapshot={currentSnapshot}
              vehicleMeta={currentVehicleMeta}
              predictiveResult={predictiveResult}
              isLoading={isAnalyzingPredictive}
              onAnalyzePredictive={() => runPredictiveAnalysis(selectedVehicleId, currentSnapshot)}
              onViewJson={() => openJsonTab('predictive')}
            />
            </div>
          </div>
        )}

        {/* TAB 5: GPS MINI-MAP & CORRIDOR ROUTE */}
        {activeTab === 'map' && currentVehicleMeta && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-3xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-3xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100 font-display">
                    Commercial Vehicle Fleet GPS Telematics & Location Metadata
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Unit: {currentVehicleMeta.vehicle_id} ({currentVehicleMeta.make_model}) • Driver: {currentVehicleMeta.driver}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-200 border border-slate-700">
                  Speed: <strong className="text-amber-400">{currentSnapshot.telemetry.speed_kmh} KMPH</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-200 border border-slate-700">
                  Heading: <strong className="text-cyan-400">{currentVehicleMeta.coordinates.heading ?? 0}°</strong>
                </span>
              </div>
            </div>

            <MiniMap
              vehicle={currentVehicleMeta}
              allVehicles={vehicles}
              status={diagnosticResult?.status}
              speedKmh={currentSnapshot.telemetry.speed_kmh}
              onSelectVehicle={handleSelectVehicle}
              onOpenModal={() => setIsMiniMapOpen(true)}
            />

            {/* Fuel & Telemetry quick stats for context */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-1 font-mono text-xs">
                <div className="text-slate-400 uppercase text-[10px]">Location Description</div>
                <div className="text-slate-100 font-semibold text-sm">{currentVehicleMeta.location}</div>
                <div className="text-amber-400 text-[11px] pt-1">{currentVehicleMeta.coordinates.route_corridor}</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-1 font-mono text-xs">
                <div className="text-slate-400 uppercase text-[10px]">Altitude & Terrain</div>
                <div className="text-slate-100 font-semibold text-sm">{currentVehicleMeta.coordinates.altitude_m ?? 500} m Above Sea Level</div>
                <div className="text-slate-400 text-[11px] pt-1">Landmark: {currentVehicleMeta.coordinates.landmark}</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-1 font-mono text-xs">
                <div className="text-slate-400 uppercase text-[10px]">Active Engine Telemetry</div>
                <div className="text-emerald-400 font-semibold text-sm">
                  {currentSnapshot.telemetry.instant_kml ?? 5.2} km/l • {currentSnapshot.telemetry.tire_pressure_psi ?? 84} PSI
                </div>
                <div className="text-slate-400 text-[11px] pt-1">Load: {currentSnapshot.telemetry.engine_load_pct}% • Soot: {currentSnapshot.telemetry.soot_level_g ?? 24}g</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: FLEET ROSTER & VEHICLE MANAGEMENT */}
        {activeTab === 'fleet' && (
          <FleetRosterPanel
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={handleSelectVehicle}
            onOpenAddVehicle={() => setIsAddVehicleModalOpen(true)}
            currentUser={currentUser}
            onInspectVehicle={(vid) => {
              handleSelectVehicle(vid);
              setActiveTab('all');
            }}
          />
        )}
        </>
        )}
      </main>

      {/* Phone: bottom tab bar */}
      {fleetReady && (
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 apple-tabbar no-print" aria-label="Sections">
        <div className="flex" role="tablist">
          {APP_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} role="tab" aria-selected={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
                <Icon className="w-[22px] h-[22px]" />
                <span>{t.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
      )}

      <footer className="hidden md:block py-6 px-4 text-center text-[12px] text-slate-500 no-print">
        FleetDiag AI · Heavy-duty commercial vehicle diagnostics
      </footer>

      {/* Authentication & User Profile Modal */}
      <LoginModal
        key={`login-${currentUser?.id}`}
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        onLogin={handleLoginUser}
        onLogout={handleLogoutUser}
      />

      <ObdConnectionModal
        key={`obd-${currentUser?.id}`}
        isOpen={isObdModalOpen}
        onClose={() => setIsObdModalOpen(false)}
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={handleSelectVehicle}
        isSimulating={isSimulating}
        onToggleSimulation={toggleSimulation}
        isLeadDeveloper={canSimulate}
        onDataReceived={(data, targetVehicleId) => {
          const effectiveId = targetVehicleId || selectedVehicleId;
          setVehicles((prev) =>
            prev.map((v) =>
              v.vehicle_id === effectiveId
                ? { ...v, telemetry: { ...v.telemetry, ...data } }
                : v
            )
          );
          if (effectiveId === selectedVehicleId) {
            setCurrentSnapshot((prev) => ({
              ...prev,
              telemetry: { ...prev.telemetry, ...data }
            }));
          }
        }}
      />

      {/* Developer-only Fleets screen. Rendered outside the guarded dashboard so it works in empty, loading and error states. */}
      <FleetsModal
        isOpen={isFleetsOpen && currentUser?.role === 'developer'}
        onClose={() => setIsFleetsOpen(false)}
        activeFleetId={currentUser?.fleetId}
      />

      <AddStaffModal
        key={`staff-${currentUser?.id}`}
        isOpen={isAddStaffOpen && canAddStaff(currentUser)}
        onClose={() => setIsAddStaffOpen(false)}
        creatorRole={currentUser?.role ?? 'technician'}
        fleetName={currentUser?.fleetName}
      />

      {/* Add New Commercial Fleet Vehicle Modal */}
      <AddVehicleModal
        isOpen={isAddVehicleModalOpen}
        onClose={() => setIsAddVehicleModalOpen(false)}
        onAddVehicle={handleAddVehicle}
        existingVehicleIds={vehicles.map((v) => v.vehicle_id)}
      />

      {/* Printable Work Order Modal */}
      <WorkOrderModal
        isOpen={isWorkOrderOpen && fleetReady}
        onClose={() => setIsWorkOrderOpen(false)}
        snapshot={currentSnapshot}
        result={diagnosticResult}
        vehicleMeta={currentVehicleMeta}
      />

      {/* JSON Payload and Schema Inspector Modal */}
      <JsonPayloadModal
        isOpen={isJsonModalOpen && fleetReady}
        onClose={() => setIsJsonModalOpen(false)}
        currentSnapshot={currentSnapshot}
        currentResult={diagnosticResult}
        fuelResult={fuelResult}
        predictiveResult={predictiveResult}
        initialTab={jsonModalTab}
        onLoadCustomJson={handleLoadCustomJson}
      />

      {/* Tata Motors BSVI DTC Manual & Troubleshooting Modal */}
      <TataMotorsDtcModal
        isOpen={isTataManualOpen && fleetReady}
        onClose={() => setIsTataManualOpen(false)}
        activeCodes={currentSnapshot.telemetry.active_dtc_codes}
        onAddCode={(code) => {
          handleUpdateCodes([...currentSnapshot.telemetry.active_dtc_codes, code]);
        }}
      />

      {/* Commercial Vehicle Sensor Specifications & Definitions Modal */}
      <SensorDefinitionsModal
        isOpen={isSensorModalOpen && fleetReady}
        onClose={() => setIsSensorModalOpen(false)}
        telemetry={currentSnapshot.telemetry}
      />

      {/* Dedicated Fullscreen Live GPS Tracking Feed Modal with Background Scroll Lock */}
      {currentVehicleMeta && (
        <LiveTrackingModal
          isOpen={isMiniMapOpen}
          onClose={() => setIsMiniMapOpen(false)}
          vehicle={currentVehicleMeta}
          allVehicles={vehicles}
          status={diagnosticResult?.status}
          speedKmh={currentSnapshot.telemetry.speed_kmh}
          onSelectVehicle={handleSelectVehicle}
        />
      )}

      {/* Unified Vehicle Dynamics, Load & Driving Profile Hub Modal */}
      <VehicleDynamicsHubModal
        isOpen={(isDynamicsHubOpen || isLoadEmulatorOpen) && fleetReady}
        onClose={() => {
          setIsDynamicsHubOpen(false);
          setIsLoadEmulatorOpen(false);
        }}
        initialTab={isLoadEmulatorOpen ? 'load' : dynamicsHubInitialTab}
        canSimulate={canSimulate}
        currentVehicle={currentVehicleMeta}
        vehicleLoadKg={vehicleLoadKg}
        loadPreset={loadPreset}
        onUpdateVehicleLoad={(loadKg, preset) => {
          setVehicleLoadKg(loadKg);
          if (preset) setLoadPreset(preset);
        }}
        simCondition={simCondition}
        onSelectSimCondition={setSimCondition}
        gradePct={currentGrade}
        isSimulating={isSimulating}
        onToggleSimulation={toggleSimulation}
        onOpenObdReader={() => {
          setIsDynamicsHubOpen(false);
          setIsLoadEmulatorOpen(false);
          setIsObdModalOpen(true);
        }}
      />

      {/* Lead Developer Command Console Modal (Restricted strictly to Lead Dev Sarthak Gohil) */}
      {isLeadDeveloper && fleetReady && (
        <DeveloperCommandModal
          isOpen={isDeveloperConsoleOpen}
          onClose={() => setIsDeveloperConsoleOpen(false)}
          initialTab={developerConsoleTab}
          canSimulate={canSimulate}
          currentUser={currentUser}
          vehicles={vehicles}
          currentVehicleId={selectedVehicleId}
          onSelectVehicle={handleSelectVehicle}
          currentSnapshot={currentSnapshot}
          onUpdateTelemetry={handleUpdateTelemetry}
          isSimulating={isSimulating}
          onToggleSimulation={toggleSimulation}
          simCondition={simCondition}
          onSelectSimCondition={setSimCondition}
          gradePct={currentGrade}
          onRunDiagnostics={() => runAllAnalyses(currentSnapshot, true)}
          onOpenAddVehicle={() => setIsAddVehicleModalOpen(true)}
          vehicleLoadKg={vehicleLoadKg}
          loadPreset={loadPreset}
          onUpdateVehicleLoad={(loadKg, preset) => {
            setVehicleLoadKg(loadKg);
            if (preset) setLoadPreset(preset);
          }}
        />
      )}
    </div>
  );
}
