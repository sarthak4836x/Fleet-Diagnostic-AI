import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Radio,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  Code,
  Copy,
  Check,
  Zap,
  Gauge,
  Send,
  Terminal,
  Truck,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { FleetVehicle, VehicleSnapshot } from '../types';
import {
  decodeRawTelematicsPayload,
  generateSimulatedObdHex,
  DecodedTelematicsOutput
} from '../services/obdDecoder';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface ObdConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: FleetVehicle[];
  selectedVehicleId: string;
  onSelectVehicle?: (id: string) => void;
  onDataReceived: (
    data: Partial<VehicleSnapshot['telemetry']>,
    targetVehicleId?: string
  ) => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  isLeadDeveloper?: boolean;
}

type SimScenario = 'nominal' | 'high_load' | 'overheat' | 'faults' | 'corrupted';

export const ObdConnectionModal: React.FC<ObdConnectionModalProps> = ({
  isOpen,
  onClose,
  vehicles = [],
  selectedVehicleId,
  onSelectVehicle,
  onDataReceived,
  isSimulating,
  onToggleSimulation,
  isLeadDeveloper = false,
}) => {
  useBodyScrollLock(isOpen);

  // Target vehicle selection: 'ALL' or specific vehicle_id
  const [targetVehicleId, setTargetVehicleId] = useState<string>(selectedVehicleId || 'ALL');

  // Simulator interval & scenario
  const [streamIntervalMs, setStreamIntervalMs] = useState<number>(2000);
  const [scenario, setScenario] = useState<SimScenario>('nominal');

  // Custom manual hex payload input
  const [manualPayload, setManualPayload] = useState<string>(
    'Mode 01 PID 0C response: 41 0C 1A F8\n' +
    'Mode 01 PID 05 response: 41 05 82\n' +
    'Mode 01 PID 0D response: 41 0D 4A\n' +
    'Mode 01 PID 11 response: 41 11 5A'
  );

  // Live stream outputs
  const [currentDecoded, setCurrentDecoded] = useState<DecodedTelematicsOutput | null>(null);
  const [streamLogs, setStreamLogs] = useState<Array<{ id: string; time: string; vehicleId: string; raw: string }>>([]);
  const [copiedJson, setCopiedJson] = useState(false);
  const [manualInjectedSuccess, setManualInjectedSuccess] = useState(false);

  // State refs for simulation loop and dynamic props
  const simTimerRef = useRef<any>(null);
  const tickRef = useRef<number>(0);
  const vehicleIndexRef = useRef<number>(0);

  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;

  const targetVehicleIdRef = useRef(targetVehicleId);
  targetVehicleIdRef.current = targetVehicleId;

  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  const onDataReceivedRef = useRef(onDataReceived);
  onDataReceivedRef.current = onDataReceived;

  // Track dynamic thermal and load physics across ticks
  const simPhysRef = useRef({ coolant: 89, climbTicks: 0 });

  // Synchronize targetVehicleId when selectedVehicleId changes from outside
  useEffect(() => {
    if (selectedVehicleId && targetVehicleId !== 'ALL' && targetVehicleId !== selectedVehicleId) {
      setTargetVehicleId(selectedVehicleId);
    }
  }, [selectedVehicleId, targetVehicleId]);

  // Handle ESC key close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Main autonomous simulation loop
  useEffect(() => {
    if (!isOpen || !isSimulating) {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      return;
    }

    const runSimulationStep = () => {
      const currentVehicles = vehiclesRef.current;
      if (!currentVehicles || currentVehicles.length === 0) return;

      tickRef.current += 1;
      const tick = tickRef.current;
      const currentTarget = targetVehicleIdRef.current;
      const currentScenario = scenarioRef.current;

      // Determine which vehicle is sending this frame
      let activeVehicle: FleetVehicle | undefined;
      if (currentTarget === 'ALL') {
        activeVehicle = currentVehicles[vehicleIndexRef.current % currentVehicles.length];
        vehicleIndexRef.current += 1;
      } else {
        activeVehicle = currentVehicles.find((v) => v.vehicle_id === currentTarget) || currentVehicles[0];
      }

      if (!activeVehicle) return;

      // Generate realistic dynamic telemetry based on scenario and vehicle
      const baseRpm = activeVehicle.telemetry?.engine_rpm || 1350;
      const baseSpeed = activeVehicle.telemetry?.speed_kmh || 68;
      const baseCoolant = activeVehicle.telemetry?.coolant_temp_c || 88;
      const baseLoad = activeVehicle.telemetry?.engine_load_pct || 48;

      let simRpm = baseRpm;
      let simSpeed = baseSpeed;
      let simCoolant = baseCoolant;
      let simLoad = baseLoad;
      let simDtcs: string[] = [...(activeVehicle.telemetry?.active_dtc_codes || [])];

      // Oscillations and Scenario Dynamics
      const wave = Math.sin(tick * 0.4);

      if (currentScenario === 'nominal') {
        simPhysRef.current.climbTicks = 0;
        if (simPhysRef.current.coolant > 89) {
          simPhysRef.current.coolant = Number((simPhysRef.current.coolant - 0.3).toFixed(1));
        } else {
          simPhysRef.current.coolant = 89;
        }
        simRpm = Math.round(1340 + wave * 80);
        simSpeed = Math.round(70 + wave * 3);
        simCoolant = Math.round(simPhysRef.current.coolant);
        simLoad = Math.round(48 + wave * 6);
      } else if (currentScenario === 'high_load') {
        // High Load Hill Climb: RPM increases into high power band and coolant temperature rises
        simPhysRef.current.climbTicks += 1;
        const progress = Math.min(1, simPhysRef.current.climbTicks / 10);
        simRpm = Math.min(2180, Math.round(1650 + progress * 360 + wave * 90));
        simSpeed = Math.max(56, Math.round(72 - progress * 10 + wave * 2));
        // Temperature rises continuously under prolonged hill climb
        simPhysRef.current.coolant = Math.min(104, Number((simPhysRef.current.coolant + 0.45).toFixed(1)));
        simCoolant = Math.round(simPhysRef.current.coolant);
        simLoad = Math.min(95, Math.round(80 + progress * 14 + wave * 3));
      } else if (currentScenario === 'overheat') {
        simRpm = Math.round(1750 + wave * 100);
        simSpeed = Math.round(60 + wave * 3);
        simPhysRef.current.coolant = Math.min(115, Number((simPhysRef.current.coolant + 0.75).toFixed(1)));
        simCoolant = Math.round(simPhysRef.current.coolant);
        simLoad = 86;
        if (!simDtcs.includes('P0217')) simDtcs.push('P0217'); // Engine Coolant Over Temperature
      } else if (currentScenario === 'faults') {
        simRpm = Math.round(1480 + (tick % 2 === 0 ? 120 : -80));
        simSpeed = Math.round(64 + wave * 6);
        simCoolant = 91;
        simLoad = 58;
        if (!simDtcs.includes('P0171')) simDtcs.push('P0171'); // System Too Lean (Bank 1)
        if (!simDtcs.includes('P0300')) simDtcs.push('P0300'); // Random / Multiple Cylinder Misfire
      } else if (currentScenario === 'corrupted') {
        simRpm = 1350;
        simSpeed = 70;
        simCoolant = 89;
      }

      // Generate raw OBD-II hexadecimal string
      let rawPayload = generateSimulatedObdHex({
        engine_rpm: simRpm,
        speed_kmh: simSpeed,
        coolant_temp_c: simCoolant,
        engine_load_pct: simLoad,
        active_dtc_codes: simDtcs,
      });

      // Inject edge transmission corruption if corrupted scenario is active
      if (currentScenario === 'corrupted' && tick % 2 === 0) {
        rawPayload += '\nCORRUPTED_CAN_FRAME_ERR_0x7F_NOISE\nMode 01 PID 99 response: 41 99 FF';
      }

      // Decode using expert automotive telematics decoder
      const decoded = decodeRawTelematicsPayload(rawPayload);
      setCurrentDecoded(decoded);

      // Append to rolling log (keep last 20 frames)
      const logEntry = {
        id: `${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString(),
        vehicleId: activeVehicle.vehicle_id,
        raw: rawPayload.replace(/\n/g, ' • '),
      };

      setStreamLogs((prev) => [logEntry, ...prev.slice(0, 25)]);

      // Push telemetry updates to application state for the vehicle
      const updates: Partial<VehicleSnapshot['telemetry']> = {};
      if (decoded.telemetry_metrics.engine_rpm !== null) updates.engine_rpm = decoded.telemetry_metrics.engine_rpm;
      if (decoded.telemetry_metrics.vehicle_speed_kmh !== null) updates.speed_kmh = decoded.telemetry_metrics.vehicle_speed_kmh;
      if (decoded.telemetry_metrics.coolant_temp_celsius !== null) updates.coolant_temp_c = decoded.telemetry_metrics.coolant_temp_celsius;
      if (decoded.telemetry_metrics.throttle_position_percent !== null) updates.engine_load_pct = decoded.telemetry_metrics.throttle_position_percent;
      if (decoded.diagnostic_trouble_codes.length > 0) updates.active_dtc_codes = decoded.diagnostic_trouble_codes;

      onDataReceivedRef.current?.(updates, activeVehicle.vehicle_id);
    };

    // Run first step with a slight timeout so it doesn't trigger during initial synchronous render
    const initialTimer = setTimeout(runSimulationStep, 20);

    simTimerRef.current = setInterval(runSimulationStep, streamIntervalMs);
    return () => {
      clearTimeout(initialTimer);
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  }, [isOpen, isSimulating, streamIntervalMs]);

  if (!isOpen) return null;

  // Manual payload inject handler
  const handleInjectManual = () => {
    if (!manualPayload.trim()) return;

    const activeVehicleId = targetVehicleId === 'ALL'
      ? (selectedVehicleId || vehicles[0]?.vehicle_id)
      : targetVehicleId;

    const decoded = decodeRawTelematicsPayload(manualPayload);
    setCurrentDecoded(decoded);

    const logEntry = {
      id: `${Date.now()}-${Math.random()}`,
      time: new Date().toLocaleTimeString(),
      vehicleId: activeVehicleId,
      raw: `[MANUAL INJECT] ${manualPayload.replace(/\n/g, ' • ')}`,
    };
    setStreamLogs((prev) => [logEntry, ...prev.slice(0, 25)]);

    const updates: Partial<VehicleSnapshot['telemetry']> = {};
    if (decoded.telemetry_metrics.engine_rpm !== null) updates.engine_rpm = decoded.telemetry_metrics.engine_rpm;
    if (decoded.telemetry_metrics.vehicle_speed_kmh !== null) updates.speed_kmh = decoded.telemetry_metrics.vehicle_speed_kmh;
    if (decoded.telemetry_metrics.coolant_temp_celsius !== null) updates.coolant_temp_c = decoded.telemetry_metrics.coolant_temp_celsius;
    if (decoded.telemetry_metrics.throttle_position_percent !== null) updates.engine_load_pct = decoded.telemetry_metrics.throttle_position_percent;
    if (decoded.diagnostic_trouble_codes.length > 0) updates.active_dtc_codes = decoded.diagnostic_trouble_codes;

    onDataReceived(updates, activeVehicleId);
    setManualInjectedSuccess(true);
    setTimeout(() => setManualInjectedSuccess(false), 2000);
  };

  const handleCopyJson = () => {
    if (!currentDecoded) return;
    navigator.clipboard.writeText(JSON.stringify(currentDecoded, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleInspectVehicleInDashboard = (vId: string) => {
    if (onSelectVehicle) {
      onSelectVehicle(vId);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl relative text-slate-100 p-4 sm:p-6 flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Radio className={`w-5 h-5 ${isSimulating ? 'animate-pulse text-emerald-300' : 'text-slate-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-sans">
                  {isLeadDeveloper ? 'Fleet OBD-II Telematics Scanner & Simulator' : 'Fleet OBD-II Telematics Scanner'}
                </h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  isSimulating
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSimulating ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  {isSimulating ? 'LIVE RECEIVER' : 'STANDBY'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {vehicles.length} Active Fleet Units
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {isLeadDeveloper
                  ? 'Receiving & decoding raw ECU hexadecimal telemetry (Mode 01/03) across all registered vehicles.'
                  : 'Decodes raw ECU telemetry (Mode 01/03) for your registered vehicles.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close OBD Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fleet Vehicle Stream Selector Bar */}
        <div className="py-3 border-b border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              Select Telematics Stream Target:
            </span>
            {isLeadDeveloper && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Interval:</span>
              {[1000, 2000, 4000].map((ms) => (
                <button
                  key={ms}
                  onClick={() => setStreamIntervalMs(ms)}
                  className={`px-2 py-0.5 rounded-xl text-[11px] font-mono border transition-all ${
                    streamIntervalMs === ms
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {ms / 1000}s
                </button>
              ))}
            </div>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {/* Multiplexed ALL button */}
            <button
              onClick={() => setTargetVehicleId('ALL')}
              className={`px-3 py-1.5 rounded-3xl text-xs font-mono font-medium flex items-center gap-1.5 border shrink-0 transition-all ${
                targetVehicleId === 'ALL'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>All Fleet Vehicles (Multiplexed)</span>
            </button>

            {/* Individual Vehicle Pills */}
            {vehicles.map((v) => {
              const isSelected = targetVehicleId === v.vehicle_id;
              const hasDtcs = (v.telemetry.active_dtc_codes?.length || 0) > 0;
              return (
                <button
                  key={v.vehicle_id}
                  onClick={() => setTargetVehicleId(v.vehicle_id)}
                  className={`px-3 py-1.5 rounded-3xl text-xs font-mono flex items-center gap-2 border shrink-0 transition-all ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/30 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-white font-semibold">{v.vehicle_id}</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                    {(v.make_model || v.unit_name || 'Vehicle').split(' ')[0]}
                  </span>
                  {hasDtcs && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Active DTCs" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Simulation Controls & Scenario Injectors */}
        <div className="py-2.5 px-3 bg-slate-950/90 rounded-3xl border border-slate-800/80 my-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            {isLeadDeveloper && (
              <>
                <button
                  onClick={onToggleSimulation}
                  title={isSimulating ? "Click to pause live OBD telematics stream" : "Click to resume live OBD telematics stream"}
                  className={`px-3 py-1.5 rounded-2xl font-semibold flex items-center gap-1.5 transition-all ${
                    isSimulating
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause OBD Telematics</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume OBD Telematics</span>
                    </>
                  )}
                </button>

                <span className="text-slate-600">|</span>
              </>
            )}

            {isLeadDeveloper && (<>
            <span className="text-slate-400 uppercase text-[10px]">Simulate Scenario:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'nominal', label: 'Nominal Cruise' },
                { id: 'high_load', label: 'High Load Hill Climb' },
                { id: 'overheat', label: 'Coolant Overheat' },
                { id: 'faults', label: 'DTC Fault Injection' },
                { id: 'corrupted', label: 'Noise & Malformed' },
              ].map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setScenario(sc.id as SimScenario)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono border transition-all ${
                    scenario === sc.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
            </>)}
          </div>

          {targetVehicleId !== 'ALL' && (
            <button
              onClick={() => handleInspectVehicleInDashboard(targetVehicleId)}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
            >
              <span>Inspect {targetVehicleId} in Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Content Body: Split Screen. Everything in it comes from generated frames, so demo fleets only */}
        {isLeadDeveloper ? (
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column (7 cols): Live Raw Incoming OBD-II Hex Stream */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            {/* Live Metrics Extractors */}
            {currentDecoded && (
              <div className="bg-slate-950 p-3 rounded-3xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold flex items-center gap-1.5">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    Decoded Parameters From Current OBD Frame
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {currentDecoded.timestamp_processed?.includes('T')
                      ? currentDecoded.timestamp_processed.split('T')[1]?.replace('Z', '')
                      : currentDecoded.timestamp_processed || ''} UTC
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">RPM (PID 0C)</span>
                    <strong className="text-cyan-300 text-sm">
                      {currentDecoded.telemetry_metrics.engine_rpm !== null
                        ? `${currentDecoded.telemetry_metrics.engine_rpm} RPM`
                        : '—'}
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Speed (PID 0D)</span>
                    <strong className="text-amber-300 text-sm">
                      {currentDecoded.telemetry_metrics.vehicle_speed_kmh !== null
                        ? `${currentDecoded.telemetry_metrics.vehicle_speed_kmh} km/h`
                        : '—'}
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Coolant (PID 05)</span>
                    <strong
                      className={`text-sm ${
                        (currentDecoded.telemetry_metrics.coolant_temp_celsius || 0) > 100
                          ? 'text-rose-400 font-bold'
                          : 'text-emerald-300'
                      }`}
                    >
                      {currentDecoded.telemetry_metrics.coolant_temp_celsius !== null
                        ? `${currentDecoded.telemetry_metrics.coolant_temp_celsius} °C`
                        : '—'}
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Throttle (PID 11)</span>
                    <strong className="text-blue-300 text-sm">
                      {currentDecoded.telemetry_metrics.throttle_position_percent !== null
                        ? `${currentDecoded.telemetry_metrics.throttle_position_percent} %`
                        : '—'}
                    </strong>
                  </div>
                </div>

                {/* DTC Badges if extracted */}
                {currentDecoded.diagnostic_trouble_codes.length > 0 && (
                  <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono text-rose-400 uppercase font-semibold">
                      Mode 03 DTCs Decoded:
                    </span>
                    {currentDecoded.diagnostic_trouble_codes.map((dtc) => (
                      <span
                        key={dtc}
                        className="px-2 py-0.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold"
                      >
                        {dtc}
                      </span>
                    ))}
                  </div>
                )}

                {/* Warnings / Corrupted frames */}
                {currentDecoded.decoding_errors.length > 0 && (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-mono space-y-0.5">
                    <span className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      Frame Warnings Handled:
                    </span>
                    {currentDecoded.decoding_errors.map((err, i) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live Incoming Hex Stream Terminal */}
            <div className="flex-1 flex flex-col bg-[#05080f] rounded-3xl border border-slate-800 p-3 font-mono text-xs overflow-hidden min-h-[160px]">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-2">
                <span className="text-[10px] uppercase text-slate-400 flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-emerald-400" />
                  Live Receiver Log (Raw OBD-II Hexadecimal Packets)
                </span>
                <span className="text-[10px] text-slate-500">{streamLogs.length} frames logged</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin max-h-[180px]">
                {streamLogs.length === 0 ? (
                  <span className="text-slate-600">Awaiting stream packets...</span>
                ) : (
                  streamLogs.map((log) => (
                    <div key={log.id} className="leading-tight text-[11px] flex items-start gap-1.5">
                      <span className="text-slate-500 shrink-0">[{log.time}]</span>
                      <span className="text-amber-400 font-bold shrink-0">[{log.vehicleId}]</span>
                      <span className="text-emerald-400/90 break-all">{log.raw}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Manual Raw Hex Transmission Box */}
            <div className="bg-slate-950 p-3 rounded-3xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono text-slate-300 uppercase flex items-center gap-1.5">
                  <Send className="w-3 h-3 text-cyan-400" />
                  Manual Raw OBD Hex Frame Injection
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  Target: {targetVehicleId === 'ALL' ? selectedVehicleId : targetVehicleId}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={manualPayload}
                  onChange={(e) => setManualPayload(e.target.value)}
                  placeholder="e.g. Mode 01 PID 0C response: 41 0C 1A F8"
                  className="flex-1 bg-[#05080f] border border-slate-700 rounded-2xl px-3 py-1.5 font-mono text-xs text-amber-300 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleInjectManual}
                  className="px-3.5 py-1.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs font-mono shrink-0 transition-colors flex items-center gap-1"
                >
                  {manualInjectedSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>Injected!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Inject</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Standardized Backend JSON Output */}
          <div className="lg:col-span-5 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                Standardized Backend JSON Output
              </label>
              <button
                onClick={handleCopyJson}
                className="text-xs font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                title="Copy Standardized Output JSON"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 bg-[#05080f] rounded-3xl border border-slate-800 p-3.5 font-mono text-xs overflow-y-auto max-h-[500px] scrollbar-thin">
              {currentDecoded ? (
                <pre className="text-cyan-300 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(currentDecoded, null, 2)}
                </pre>
              ) : (
                <span className="text-slate-600">Waiting for telematics packet...</span>
              )}
            </div>

            <div className="p-2.5 bg-slate-950/80 rounded-3xl border border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-1">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span>Standardized Output Contract</span>
                <span className="text-emerald-400 text-[10px]">Strict JSON Format</span>
              </div>
              <div className="text-[10px] text-slate-400 leading-normal">
                Transmitted to FleetDiag backend `/api/diagnose` to evaluate engine stress, predictive maintenance, and DTC fault advisories.
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-16 text-sm text-slate-400">No OBD stream is connected.</div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span>Protocol: SAE J1979 OBD-II Mode 01/03 & ISO 15765 CAN</span>
          </div>
          <div className="flex items-center gap-2">
            {targetVehicleId !== 'ALL' && (
              <button
                onClick={() => handleInspectVehicleInDashboard(targetVehicleId)}
                className="px-3 py-1.5 rounded-2xl bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/30 transition-colors flex items-center gap-1.5"
              >
                <span>Inspect in Dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
