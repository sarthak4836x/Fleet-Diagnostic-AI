import React, { useState } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  Scale,
  Mountain,
  Radio,
  Truck,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Fuel,
  Activity,
  X,
  Zap,
  Layers,
  Compass,
  Flame,
  RotateCw,
  Play,
  Pause,
  Sliders,
  Check,
  ArrowRight,
  Info,
} from 'lucide-react';
import { FleetVehicle, SimCondition, VehicleLoadPreset } from '../types';

export type DynamicsHubTab = 'load' | 'profile';

interface VehicleDynamicsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVehicle?: FleetVehicle;
  vehicleLoadKg: number;
  onUpdateVehicleLoad: (loadKg: number, preset?: VehicleLoadPreset) => void;
  loadPreset?: VehicleLoadPreset;
  simCondition: SimCondition;
  onSelectSimCondition: (cond: SimCondition) => void;
  gradePct: number;
  onUpdateGrade?: (grade: number) => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  canSimulate?: boolean;
  initialTab?: DynamicsHubTab;
  onOpenObdReader?: () => void;
}

export const VehicleDynamicsHubModal: React.FC<VehicleDynamicsHubModalProps> = ({
  isOpen,
  onClose,
  currentVehicle,
  vehicleLoadKg,
  onUpdateVehicleLoad,
  loadPreset = 'rated',
  simCondition,
  onSelectSimCondition,
  gradePct,
  onUpdateGrade,
  isSimulating,
  onToggleSimulation,
  canSimulate = false,
  initialTab = 'load',
  onOpenObdReader,
}) => {
  useBodyScrollLock(isOpen);

  const [selectedTab, setActiveTab] = useState<DynamicsHubTab>(initialTab);
  // The profile tab only drives the simulator, so it is never the open tab without one
  const activeTab: DynamicsHubTab = canSimulate ? selectedTab : 'load';
  const [draftLoadKg, setDraftLoadKg] = useState<number>(vehicleLoadKg);
  const [draftPreset, setDraftPreset] = useState<VehicleLoadPreset>(loadPreset);
  const [draftCondition, setDraftCondition] = useState<SimCondition>(simCondition);
  const [draftGrade, setDraftGrade] = useState<number>(gradePct || 7.5);
  const [showAppliedToast, setShowAppliedToast] = useState(false);

  // Sync state if opened with different props
  React.useEffect(() => {
    if (isOpen) {
      setDraftLoadKg(vehicleLoadKg);
      setDraftPreset(loadPreset);
      setDraftCondition(simCondition);
      setDraftGrade(gradePct || 7.5);
      if (initialTab) setActiveTab(initialTab);
    }
  }, [isOpen, vehicleLoadKg, loadPreset, simCondition, gradePct, initialTab]);

  if (!isOpen) return null;

  // Base specs for commercial vehicle tare vs legal GVW
  const tareWeightKg = 11500; // Unladen chassis & cabin tare
  const ratedLegalGvwKg = 40000; // 40 Tonne legal gross vehicle weight rating
  const payloadKg = Math.max(0, draftLoadKg - tareWeightKg);
  const isOverloaded = draftLoadKg > ratedLegalGvwKg;
  const overloadExcessKg = Math.max(0, draftLoadKg - ratedLegalGvwKg);
  const loadPercentage = Math.round((draftLoadKg / ratedLegalGvwKg) * 100);

  // Axle distributions (6x4 or Multi-axle commercial layout)
  const steerAxleKg = Math.round(draftLoadKg * 0.16);
  const driveAxleKg = Math.round(draftLoadKg * 0.48);
  const trailerAxleKg = Math.round(draftLoadKg * 0.36);

  // Pneumatic Air Suspension Pressure (SPN 875 / SAE J1939 Bellows bar)
  const airBellowsBar = Number((2.0 + (draftLoadKg / ratedLegalGvwKg) * 5.2).toFixed(1));

  // Dynamic engine load offset under steady cruise
  const engineLoadOffsetPct = Math.round(((draftLoadKg - ratedLegalGvwKg) / ratedLegalGvwKg) * 40);

  // Fuel Consumption Penalty factor
  const fuelPenaltyPct = Math.round(((draftLoadKg - ratedLegalGvwKg) / ratedLegalGvwKg) * 55);

  // Kinetic Braking Distance Multiplier
  const brakingDistanceFactor = Number((0.9 + (draftLoadKg / ratedLegalGvwKg) * 0.6).toFixed(2));

  // Projected Dynamic Engine Performance for current merged state
  const projectedMetrics = (() => {
    let baseRpm = 1450;
    let baseSpeed = 72;
    let baseLoad = 62;
    let baseCoolant = 88;
    let baseFuelRate = 22.5;

    // Modulate by Load
    const loadFactor = draftLoadKg / ratedLegalGvwKg;
    baseLoad = Math.round(baseLoad * (0.65 + loadFactor * 0.35));
    baseFuelRate = Number((baseFuelRate * (0.7 + loadFactor * 0.35)).toFixed(1));

    // Modulate by Driving Profile
    if (draftCondition === 'hill_climb') {
      const gradeFactor = draftGrade / 8.0;
      baseRpm = Math.round(1850 + gradeFactor * 240);
      baseSpeed = Math.round(Math.max(38, 65 - gradeFactor * 18));
      baseLoad = Math.min(99, Math.round(baseLoad + 25 * gradeFactor));
      baseCoolant = Math.round(baseCoolant + 11 * gradeFactor);
      baseFuelRate = Number((baseFuelRate * 1.45).toFixed(1));
    } else if (draftCondition === 'cruise') {
      baseRpm = 1380;
      baseSpeed = 78;
      baseLoad = Math.round(baseLoad * 0.85);
      baseCoolant = 86;
    } else if (draftCondition === 'overheat') {
      baseRpm = 1720;
      baseSpeed = 58;
      baseLoad = Math.min(96, baseLoad + 18);
      baseCoolant = 112; // Overheat threshold
      baseFuelRate = Number((baseFuelRate * 1.3).toFixed(1));
    } else if (draftCondition === 'traffic') {
      baseRpm = 1100;
      baseSpeed = 24;
      baseLoad = 45;
      baseCoolant = 93;
      baseFuelRate = 18.0;
    } else if (draftCondition === 'route_cycle') {
      baseRpm = 1620;
      baseSpeed = 68;
      baseLoad = 74;
      baseCoolant = 90;
    }

    return {
      rpm: baseRpm,
      speed: baseSpeed,
      load: baseLoad,
      coolant: baseCoolant,
      fuelRate: baseFuelRate,
    };
  })();

  const handleApplyPreset = (preset: VehicleLoadPreset, weight: number) => {
    setDraftPreset(preset);
    setDraftLoadKg(weight);
  };

  const handleCommitMerged = () => {
    onUpdateVehicleLoad(draftLoadKg, draftPreset);
    onSelectSimCondition(draftCondition);
    if (onUpdateGrade && draftCondition === 'hill_climb') {
      onUpdateGrade(draftGrade);
    }
    setShowAppliedToast(true);
    setTimeout(() => {
      setShowAppliedToast(false);
      onClose();
    }, 900);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 animate-in zoom-in-95 my-auto overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/95">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 mt-0.5 shrink-0 rounded-3xl bg-gradient-to-br from-amber-500/20 via-cyan-500/20 to-emerald-500/20 border border-slate-700 flex items-center justify-center text-amber-400 shadow-inner">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="space-y-1 pr-2">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight font-sans leading-tight">
                  Vehicle Dynamics & Load Hub
                </h3>
                <span className="px-1.5 py-0.5 rounded-xl text-[9px] sm:text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                  MERGED
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-mono leading-tight">
                {currentVehicle ? `${currentVehicle.vehicle_id} (${currentVehicle.make_model})` : 'Commercial Powertrain Telematics'}
                {canSimulate && ' • Unified J1939 Simulation'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenObdReader && (
              <button
                onClick={() => {
                  onClose();
                  onOpenObdReader();
                }}
                className="px-2.5 py-1.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
                title="Launch OBD-II Telematics Scanner"
              >
                <span>OBD Scanner</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Unified Dynamics Relationship Banner */}
        <div className="bg-slate-950/90 px-4 sm:px-6 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-amber-300">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Load:</span>
              <span className="font-bold">{(draftLoadKg / 1000).toFixed(1)} T</span>
              <span className="text-[10px] text-slate-500">({loadPercentage}%)</span>
            </div>

            {/* Terrain, telematics and projections describe the simulator, not this vehicle's real values */}
            {canSimulate && (<>
            <div className="hidden sm:block text-slate-700">•</div>

            <div className="flex items-center gap-1.5 text-cyan-300">
              <Mountain className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Terrain:</span>
              <span className="font-bold capitalize">
                {draftCondition === 'hill_climb' ? `Hill (+${draftGrade}%)` : draftCondition.replace('_', ' ')}
              </span>
            </div>

            <div className="hidden sm:block text-slate-700">•</div>

            <div className="flex items-center gap-1.5 text-emerald-300">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Telematics:</span>
              <span className="font-bold">{isSimulating ? '10 Hz Active' : 'Paused'}</span>
            </div>
            </>)}
          </div>

          {canSimulate && (
          <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-2xl border border-slate-800 text-[11px]">
            <span className="text-slate-400">Projected:</span>
            <span className="text-cyan-300 font-bold">{projectedMetrics.rpm} RPM</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-300 font-bold">{projectedMetrics.load}% Load</span>
            <span className="text-slate-600">|</span>
            <span className={`${projectedMetrics.coolant >= 105 ? 'text-rose-400' : 'text-emerald-300'} font-bold`}>
              {projectedMetrics.coolant}°C
            </span>
          </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4 sm:px-6 gap-2 pt-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('load')}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold transition-all ${
              activeTab === 'load'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>1. Vehicle Load & Axles</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-xl bg-amber-500/20 text-amber-300">
              {(draftLoadKg / 1000).toFixed(1)}T
            </span>
          </button>

          {canSimulate && (
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold transition-all ${
              activeTab === 'profile'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>2. Driving & Terrain Profile</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-xl bg-cyan-500/20 text-cyan-300 capitalize">
              {draftCondition.replace('_', ' ')}
            </span>
          </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[60vh] space-y-5">
          {/* TAB 1: VEHICLE LOAD EMULATOR */}
          {activeTab === 'load' && (
            <div className="space-y-5">
              {/* Presets Grid */}
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Standard Commercial Load Presets:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('unladen', 11500)}
                    className={`p-2.5 rounded-3xl border text-left transition-all ${
                      draftPreset === 'unladen'
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-100">Tare Chassis</div>
                    <div className="text-xs font-mono text-amber-400 font-bold">11.5 Tonne</div>
                    <div className="text-[10px] text-slate-500">Unladen Cabin</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('half', 28000)}
                    className={`p-2.5 rounded-3xl border text-left transition-all ${
                      draftPreset === 'half'
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-100">Partial Load</div>
                    <div className="text-xs font-mono text-amber-400 font-bold">28.0 Tonne</div>
                    <div className="text-[10px] text-slate-500">70% Payload</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('rated', 40000)}
                    className={`p-2.5 rounded-3xl border text-left transition-all ${
                      draftPreset === 'rated'
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-emerald-300 flex items-center justify-between">
                      <span>Legal Rated</span>
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="text-xs font-mono text-emerald-400 font-bold">40.0 Tonne</div>
                    <div className="text-[10px] text-slate-500">100% Legal GVW</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('overload', 49500)}
                    className={`p-2.5 rounded-3xl border text-left transition-all ${
                      draftPreset === 'overload'
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-rose-300">Heavy Overload</div>
                    <div className="text-xs font-mono text-rose-400 font-bold">49.5 Tonne</div>
                    <div className="text-[10px] text-rose-500/80">+24% Stress</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('custom', 55000)}
                    className={`p-2.5 rounded-3xl border text-left transition-all col-span-2 sm:col-span-1 ${
                      draftPreset === 'custom'
                        ? 'bg-rose-900/40 border-rose-500 text-rose-100 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-rose-400">Extreme Limit</div>
                    <div className="text-xs font-mono text-rose-400 font-bold">55.0 Tonne</div>
                    <div className="text-[10px] text-rose-500/80">Physical Max</div>
                  </button>
                </div>
              </div>

              {/* Dynamic Weight Slider Control */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-400" />
                    Gross Vehicle Weight (GVW):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold font-mono text-white">
                      {(draftLoadKg / 1000).toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Tonne ({draftLoadKg.toLocaleString()} kg)</span>
                  </div>
                </div>

                <input
                  id="merged-load-slider"
                  type="range"
                  min={11500}
                  max={55000}
                  step={500}
                  value={draftLoadKg}
                  onChange={(e) => {
                    setDraftLoadKg(Number(e.target.value));
                    setDraftPreset('custom');
                  }}
                  className="w-full h-2.5 bg-slate-800 rounded-2xl appearance-none cursor-pointer accent-amber-400"
                />

                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>11.5 T (Tare)</span>
                  <span className="text-emerald-400 font-semibold">40.0 T (Legal GVW Limit)</span>
                  <span className="text-rose-400">55.0 T (Suspension Peak)</span>
                </div>
              </div>

              {/* Overload Alert Notification */}
              {isOverloaded && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/40 rounded-3xl text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-rose-300">
                      Axle Overload Warning: +{(overloadExcessKg / 1000).toFixed(1)} T Over Legal GVW
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      Vehicle exceeds standard CMV 40-tonne commercial highway regulations. Causes elevated transmission fluid heat, increased tire deflection, brake fade risk, and +{fuelPenaltyPct}% diesel burn.
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-Axle Distribution Cards */}
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Multi-Axle Bogie Weight Distribution (SAE J1939):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-3xl">
                    <div className="text-slate-400 text-[11px] mb-1">Front Steer Axle (16%)</div>
                    <div className="text-base font-bold font-mono text-cyan-300">
                      {(steerAxleKg / 1000).toFixed(2)} T
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">Legal: 7.20 T</div>
                  </div>

                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-3xl">
                    <div className="text-slate-400 text-[11px] mb-1">Drive Tandem Bogie (48%)</div>
                    <div className="text-base font-bold font-mono text-amber-300">
                      {(driveAxleKg / 1000).toFixed(2)} T
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">Legal: 19.00 T</div>
                  </div>

                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-3xl">
                    <div className="text-slate-400 text-[11px] mb-1">Trailer Tri-Axle (36%)</div>
                    <div className="text-base font-bold font-mono text-emerald-300">
                      {(trailerAxleKg / 1000).toFixed(2)} T
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">Legal: 24.00 T</div>
                  </div>
                </div>
              </div>

              {/* Physical Telemetry Derivatives */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-3xl">
                  <div className="text-[10px] text-slate-400">Suspension Bellows</div>
                  <div className="text-sm font-bold text-white">{airBellowsBar} bar</div>
                  <div className="text-[10px] text-slate-500">SPN 875</div>
                </div>

                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-3xl">
                  <div className="text-[10px] text-slate-400">Engine Load Offset</div>
                  <div className={`text-sm font-bold ${engineLoadOffsetPct > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {engineLoadOffsetPct > 0 ? `+${engineLoadOffsetPct}%` : `${engineLoadOffsetPct}%`}
                  </div>
                  <div className="text-[10px] text-slate-500">Cruise Overhead</div>
                </div>

                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-3xl">
                  <div className="text-[10px] text-slate-400">Fuel Burn Impact</div>
                  <div className={`text-sm font-bold ${fuelPenaltyPct > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fuelPenaltyPct > 0 ? `+${fuelPenaltyPct}%` : `${fuelPenaltyPct}%`}
                  </div>
                  <div className="text-[10px] text-slate-500">L/100km Factor</div>
                </div>

                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-3xl">
                  <div className="text-[10px] text-slate-400">Braking Distance</div>
                  <div className="text-sm font-bold text-white">{brakingDistanceFactor}x</div>
                  <div className="text-[10px] text-slate-500">Kinetic Multiplier</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DRIVING & TERRAIN PROFILES */}
          {activeTab === 'profile' && canSimulate && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Select Active Terrain & Driving Dynamics:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Hill Climb */}
                  <button
                    type="button"
                    onClick={() => setDraftCondition('hill_climb')}
                    className={`p-3.5 rounded-3xl border text-left transition-all ${
                      draftCondition === 'hill_climb'
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                        <Mountain className="w-4 h-4 text-amber-400" />
                        <span>High Incline Hill Climb</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        +{draftGrade}% Grade
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Simulates sustained uphill torque demand (e.g. Western Ghats / Bhor Ghat). Transmission downshifts, RPM elevates to 1900+ RPM, and cooling circuit absorbs peak thermal load.
                    </p>
                  </button>

                  {/* Flat Highway Cruise */}
                  <button
                    type="button"
                    onClick={() => setDraftCondition('cruise')}
                    className={`p-3.5 rounded-3xl border text-left transition-all ${
                      draftCondition === 'cruise'
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                        <Compass className="w-4 h-4 text-emerald-400" />
                        <span>Flat Highway Cruise</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        0.0% Grade
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Nominal high-speed cruise along golden quadrilateral corridor. Overdrive gear engaged, steady 70–80 km/h, stable 86°C coolant, and peak fuel efficiency.
                    </p>
                  </button>

                  {/* Thermal Overheat Stress */}
                  <button
                    type="button"
                    onClick={() => setDraftCondition('overheat')}
                    className={`p-3.5 rounded-3xl border text-left transition-all ${
                      draftCondition === 'overheat'
                        ? 'bg-rose-500/15 border-rose-500/60 text-rose-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                        <Flame className="w-4 h-4 text-rose-400" />
                        <span>Thermal Overheat Stress</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                        110°C Peak
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Induces high thermal load: radiator coolant surges toward 110°C, exhaust reaches 540°C, triggering ECU warning states and fan clutch override.
                    </p>
                  </button>

                  {/* Stop-and-Go City Traffic */}
                  <button
                    type="button"
                    onClick={() => setDraftCondition('traffic')}
                    className={`p-3.5 rounded-3xl border text-left transition-all ${
                      draftCondition === 'traffic'
                        ? 'bg-sky-500/15 border-sky-500/60 text-sky-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                        <Activity className="w-4 h-4 text-sky-400" />
                        <span>Stop-and-Go City Traffic</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        Low Speed
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Frequent braking and idle cycles. Low average speed (15–30 km/h), high DPF soot accumulation rate, and elevated stop/start fuel consumption.
                    </p>
                  </button>
                </div>

                {/* Dynamic Route Cycle option */}
                <button
                  type="button"
                  onClick={() => setDraftCondition('route_cycle')}
                  className={`w-full mt-3 p-3 rounded-3xl border text-left flex items-center justify-between transition-all ${
                    draftCondition === 'route_cycle'
                      ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <RotateCw className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-xs font-bold text-slate-100">Full Highway Elevation Cycle</div>
                      <div className="text-[11px] text-slate-400">
                        Automatically cycles terrain slopes and speeds dynamically over time
                      </div>
                    </div>
                  </div>
                  {draftCondition === 'route_cycle' && (
                    <span className="w-2.5 h-2.5 rounded-xl-full bg-cyan-400 animate-pulse"></span>
                  )}
                </button>
              </div>

              {/* Dynamic Slope Grade % Slider (when Hill Climb is selected) */}
              {draftCondition === 'hill_climb' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-3xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-300 font-semibold flex items-center gap-2">
                      <Mountain className="w-4 h-4 text-amber-400" />
                      Incline Slope Grade:
                    </span>
                    <span className="text-base font-bold font-mono text-white">+{draftGrade.toFixed(1)}% Grade</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={16}
                    step={0.5}
                    value={draftGrade}
                    onChange={(e) => setDraftGrade(Number(e.target.value))}
                    className="w-full h-2.5 bg-slate-800 rounded-2xl appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>+2.0% (Gentle Ascent)</span>
                    <span className="text-amber-400">+7.5% (Western Ghats Standard)</span>
                    <span className="text-rose-400">+16.0% (Extreme Mountain Pass)</span>
                  </div>
                </div>
              )}

              {/* Merged Physics Preview Card */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Live Powertrain Response for {(draftLoadKg / 1000).toFixed(1)}T + {draftCondition.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">Real-time dynamic synthesis</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-3xl">
                    <div className="text-[10px] text-slate-400">Engine Speed</div>
                    <div className="text-base font-bold text-cyan-300">{projectedMetrics.rpm} RPM</div>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-3xl">
                    <div className="text-[10px] text-slate-400">Road Speed</div>
                    <div className="text-base font-bold text-white">{projectedMetrics.speed} km/h</div>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-3xl">
                    <div className="text-[10px] text-slate-400">Engine Load</div>
                    <div className="text-base font-bold text-amber-300">{projectedMetrics.load}%</div>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-3xl">
                    <div className="text-[10px] text-slate-400">Coolant Temp</div>
                    <div className={`text-base font-bold ${projectedMetrics.coolant >= 105 ? 'text-rose-400' : 'text-emerald-300'}`}>
                      {projectedMetrics.coolant}°C
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-3xl">
                    <div className="text-[10px] text-slate-400">Fuel Rate</div>
                    <div className="text-base font-bold text-white">{projectedMetrics.fuelRate} L/h</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/95 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            {showAppliedToast ? (
              <span className="text-emerald-300 font-bold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Dynamics parameters applied to live telemetry stream!
              </span>
            ) : (
              <span>Modulating vehicle physics & SAE J1939 broadcast in real-time</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-3xl text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              id="merged-dynamics-commit-btn"
              type="button"
              onClick={handleCommitMerged}
              className="px-5 py-2 rounded-3xl text-xs font-mono font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{canSimulate ? 'Apply Load, Profile & Telematics' : 'Apply Load'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
