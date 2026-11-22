import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Thermometer,
  Zap,
  Gauge,
  Flame,
  Wind,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Layers,
  HelpCircle,
  Compass,
  CircleDot,
  Plus,
  Minus,
  RotateCw,
  Disc,
  ChevronDown,
  ChevronUp,
  Activity,
  AlertTriangle,
  Mountain,
  Radio,
} from 'lucide-react';
import { TelemetryData, SimCondition } from '../types';
import { TirePsiManagerModal } from './TirePsiManagerModal';

interface TelemetryGaugesProps {
  telemetry: TelemetryData;
  onChangeTelemetry: (newTelemetry: TelemetryData) => void;
  isEditable: boolean;
  onToggleEditable: () => void;
  onResetBenchmark?: () => void;
  onOpenSensorDefinitions?: () => void;
  isSimulating?: boolean;
  simCondition?: SimCondition;
  onSelectSimCondition?: (condition: SimCondition) => void;
  gradePct?: number;
}

export const TelemetryGauges: React.FC<TelemetryGaugesProps> = ({
  telemetry,
  onChangeTelemetry,
  isEditable,
  onToggleEditable,
  onResetBenchmark,
  onOpenSensorDefinitions,
  isSimulating,
  simCondition = 'hill_climb',
  onSelectSimCondition,
  gradePct = 7.5,
}) => {
  const [isTireModalOpen, setIsTireModalOpen] = useState(false);
  const [selectedTireCorner, setSelectedTireCorner] = useState<'ALL' | 'FL' | 'FR' | 'RL' | 'RR'>('ALL');
  const [rpmDisplayMode, setRpmDisplayMode] = useState<'BOTH' | 'ENGINE' | 'WHEELS'>('BOTH');
  const [showWheelCorners, setShowWheelCorners] = useState(false);
  const updateField = useCallback((field: keyof TelemetryData, value: number) => {
    const updated = {
      ...telemetry,
      [field]: value,
    };

    // Keep metric and imperial counterparts synced for compatibility
    if (field === 'speed_kmh') {
      updated.speed_mph = Math.round(value / 1.60934);
      updated.wheel_rpm = Math.round(value * 5.053);
    } else if (field === 'speed_mph') {
      updated.speed_kmh = Math.round(value * 1.60934);
      updated.wheel_rpm = Math.round(updated.speed_kmh * 5.053);
    } else if (field === 'wheel_rpm') {
      const calculatedSpeed = Math.round(value / 5.053);
      updated.wheel_rpm = value;
      updated.speed_kmh = calculatedSpeed;
      updated.speed_mph = Math.round(calculatedSpeed / 1.60934);
    } else if (field === 'engine_rpm') {
      updated.engine_rpm = value;
    } else if (field === 'instant_kml') {
      updated.instant_mpg = Number((value / 0.425144).toFixed(2));
    } else if (field === 'instant_mpg') {
      updated.instant_kml = Number((value * 0.425144).toFixed(2));
    } else if (field === 'fuel_rate_lph') {
      updated.fuel_rate_gph = Number((value / 3.78541).toFixed(1));
    } else if (field === 'fuel_rate_gph') {
      updated.fuel_rate_lph = Number((value * 3.78541).toFixed(1));
    }

    onChangeTelemetry(updated);
  }, [telemetry, onChangeTelemetry]);

  // Evaluators for commercial heavy truck / BSVI standards
  const getCoolantStatus = (temp: number) => {
    if (temp >= 105) return { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/40', label: 'OVERHEAT CRITICAL', alert: true };
    if (temp >= 98) return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', label: 'ELEVATED TEMP', alert: false };
    return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'NOMINAL (85-95°C)', alert: false };
  };

  const getVoltageStatus = (v: number) => {
    if (v < 23.5) return { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/40', label: 'BUS COLLAPSE', alert: true };
    if (v < 25.5) return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', label: 'LOW ALTERNATOR', alert: false };
    return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'CHARGING NOMINAL', alert: false };
  };

  const getNoxStatus = (ppm: number) => {
    if (ppm >= 1000) return { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/40', label: 'BSVI VIOLATION', alert: true };
    if (ppm >= 350) return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', label: 'SCR DERATE ADVISORY', alert: false };
    return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'AFTERTREATMENT OK', alert: false };
  };

  const getExhaustStatus = (temp: number) => {
    if (temp >= 620) return { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/40', label: 'THERMAL RUNAWAY RISK', alert: true };
    if (temp >= 520) return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', label: 'HIGH EGT PYROMETER', alert: false };
    return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'SAFE PYROMETER', alert: false };
  };

  const getSootStatus = (grams: number) => {
    if (grams >= 40.0) return { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/40', label: 'CLOGGED - DERATE (20 KMPH)', alert: true };
    if (grams >= 28.0) return { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/35', label: 'PARK REGEN REQUIRED', alert: true };
    if (grams >= 18.0) return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'ACTIVE REGEN ADVISORY', alert: false };
    return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'PASSIVE OXIDATION OK', alert: false };
  };


  const getLoadStatus = (load: number) => {
    if (load >= 85) return { color: 'text-amber-400', label: 'HEAVY HAUL GRADE' };
    return { color: 'text-slate-200', label: 'STANDARD CRUISE' };
  };

  const getEngineRpmStatus = (rpm: number) => {
    const isOptimal = rpm >= 1100 && rpm <= 1500;
    const isExceeded = rpm > 1500;
    const isCritical = rpm >= 1900;
    const progress = Math.min(100, Math.max(0, (rpm / 2500) * 100));

    if (rpm < 600) {
      return {
        label: 'SUB-IDLE / STALL RISK (<600 RPM)',
        color: 'text-amber-400',
        badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        zone: 'Low Idle',
        progress,
        isOptimal: false,
        isExceeded: false,
        isCritical: false,
      };
    }
    if (rpm <= 850) {
      return {
        label: 'CURB IDLE (WARM 600-850 RPM)',
        color: 'text-slate-300',
        badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
        zone: 'Curb Idle',
        progress,
        isOptimal: false,
        isExceeded: false,
        isCritical: false,
      };
    }
    if (rpm < 1100) {
      return {
        label: 'LOW CRUISE TRANSITION (850-1100 RPM)',
        color: 'text-sky-300',
        badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        zone: 'Transition',
        progress,
        isOptimal: false,
        isExceeded: false,
        isCritical: false,
      };
    }
    if (rpm <= 1500) {
      return {
        label: 'OPTIMAL RANGE (1100-1500 RPM)',
        color: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        zone: 'Optimal Range',
        progress,
        isOptimal: true,
        isExceeded: false,
        isCritical: false,
      };
    }
    if (rpm < 1900) {
      return {
        label: 'EXCEEDS OPTIMAL RANGE (1500-1900 RPM)',
        color: 'text-rose-400',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
        zone: 'Exceeds Optimal',
        progress,
        isOptimal: false,
        isExceeded: true,
        isCritical: false,
      };
    }
    return {
      label: 'CRITICAL OVER-REV RISK (>1900 RPM)',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-600/30 text-rose-200 border-rose-500',
      zone: 'Redline Risk',
      progress,
      isOptimal: false,
      isExceeded: true,
      isCritical: true,
    };
  };

  const getWheelRpmStatus = (wRpm: number) => {
    if (wRpm === 0) return { label: 'PARKED / AT REST', color: 'text-slate-400' };
    if (wRpm < 150) return { label: 'LOW SPEED YARD CRAWL', color: 'text-slate-300' };
    if (wRpm <= 320) return { label: 'REGIONAL & CITY ROUTE (30-65 KM/H)', color: 'text-cyan-300' };
    if (wRpm <= 420) return { label: 'HIGHWAY CRUISE (65-85 KM/H)', color: 'text-emerald-400' };
    return { label: 'EXCEEDING SPEED LIMIT (>85 KM/H)', color: 'text-rose-400' };
  };

  const sootVal = telemetry.soot_level_g ?? 24.5;
  const speedKmh = telemetry.speed_kmh ?? Math.round((telemetry.speed_mph ?? 58) * 1.60934);
  const tirePsi = telemetry.tire_pressure_psi ?? 84;

  const engineRpm = telemetry.engine_rpm ?? 1450;
  const calculatedDefaultWheelRpm = Math.round(speedKmh * 5.053);
  const wheelRpm = telemetry.wheel_rpm ?? calculatedDefaultWheelRpm;
  const gearRatio = wheelRpm > 0 ? (engineRpm / wheelRpm).toFixed(2) : '—';

  const coolantInfo = getCoolantStatus(telemetry.coolant_temp_c);
  const voltageInfo = getVoltageStatus(telemetry.battery_voltage_v);
  const noxInfo = getNoxStatus(telemetry.nox_sensor_ppm);
  const exhaustInfo = getExhaustStatus(telemetry.exhaust_temp_c);
  const sootInfo = getSootStatus(sootVal);
  const loadInfo = getLoadStatus(telemetry.engine_load_pct);
  const engineRpmInfo = getEngineRpmStatus(engineRpm);
  const isExceededOptimal = engineRpmInfo.isExceeded;
  const isCriticalRedline = engineRpmInfo.isCritical;
  const isOptimalRpm = engineRpmInfo.isOptimal;
  const wheelRpmInfo = getWheelRpmStatus(wheelRpm);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-lg relative overflow-hidden">
      {/* Header bar of gauges */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 mb-4 sm:mb-5 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-xs sm:text-sm font-semibold tracking-wide text-slate-100 uppercase font-display">
              Real-Time Powertrain & Emissions Telemetry
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
              Calibrated to BSVI commercial vehicle standards • Metric & Indian standard units
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onOpenSensorDefinitions && (
            <button
              onClick={onOpenSensorDefinitions}
              className="text-[11px] sm:text-xs text-amber-300 hover:text-amber-200 font-mono transition-colors px-2 sm:px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-1.5 shadow-sm"
              title="Open detailed sensor definitions, nominal ranges, and failure impact"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Sensor Definitions</span>
            </button>
          )}

          {onResetBenchmark && (
          <button
            onClick={onResetBenchmark}
            className="text-[11px] sm:text-xs text-slate-400 hover:text-amber-400 font-mono transition-colors px-2 py-1 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-amber-500/40"
          >
            Reset
          </button>
          )}

          <button
            onClick={onToggleEditable}
            className={`text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-xl font-medium flex items-center gap-1.5 transition-all ${
              isEditable
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <Sliders className="w-3 h-3 shrink-0" />
            <span>{isEditable ? 'Adjusting' : 'Adjust'}</span>
          </button>
        </div>
      </div>

      {/* OBD Live Telematics Stream Condition HUD Banner */}
      {isSimulating && (
        <div className="mb-4 p-2.5 sm:p-3 rounded-3xl bg-slate-950/90 border border-slate-800/90 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 sm:gap-3 text-xs font-mono animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-wider">OBD-II Stream Live</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-200">
              {simCondition === 'hill_climb' && <Mountain className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              {simCondition === 'cruise' && <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              {simCondition === 'overheat' && <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />}
              {simCondition === 'traffic' && <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
              {simCondition === 'route_cycle' && <RotateCw className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-spin" />}
              <span className="text-slate-400 hidden sm:inline">Terrain Profile:</span>
              <span className="font-bold text-amber-300">
                {simCondition === 'hill_climb' && `Steep Hill Climb (+${gradePct}% Grade Incline)`}
                {simCondition === 'cruise' && 'Optimal Highway Cruise (Flat 0.0%)'}
                {simCondition === 'overheat' && 'Thermal Stress Runaway (Overheating)'}
                {simCondition === 'traffic' && 'Urban Stop-and-Go Congestion'}
                {simCondition === 'route_cycle' && 'Dynamic Highway Terrain Cycle'}
              </span>
            </div>

            {simCondition === 'hill_climb' && (
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] sm:text-[11px]">
                <span className="px-1.5 py-0.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                  ▲ RPM Climbing (Heavy Incline Load)
                </span>
                <span className="px-1.5 py-0.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1">
                  ▲ Coolant Temp Rising (+0.4°C/s)
                </span>
              </div>
            )}
          </div>

          {/* Quick Scenario Selector Pills */}
          {onSelectSimCondition && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider hidden lg:inline">Quick Scenario:</span>
              <button
                onClick={() => onSelectSimCondition('hill_climb')}
                className={`px-2 py-1 rounded-xl text-[11px] flex items-center gap-1 border transition-all ${
                  simCondition === 'hill_climb'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Climb steep highway hill: RPM increases and coolant/exhaust temperatures rise"
              >
                <Mountain className="w-3 h-3 text-amber-400" />
                <span>Hill Climb</span>
              </button>

              <button
                onClick={() => onSelectSimCondition('cruise')}
                className={`px-2 py-1 rounded-xl text-[11px] flex items-center gap-1 border transition-all ${
                  simCondition === 'cruise'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Flat terrain: RPM settles into optimal band, temperatures cool down"
              >
                <Compass className="w-3 h-3 text-emerald-400" />
                <span>Cruise</span>
              </button>

              <button
                onClick={() => onSelectSimCondition('overheat')}
                className={`px-2 py-1 rounded-xl text-[11px] flex items-center gap-1 border transition-all ${
                  simCondition === 'overheat'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Trigger severe coolant overheating test"
              >
                <Flame className="w-3 h-3 text-rose-400" />
                <span>Overheat</span>
              </button>

              <button
                onClick={() => onSelectSimCondition('route_cycle')}
                className={`px-2 py-1 rounded-xl text-[11px] flex items-center gap-1 border transition-all ${
                  simCondition === 'route_cycle'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Automatically alternate between climbs and flats"
              >
                <RotateCw className="w-3 h-3 text-cyan-400" />
                <span>Auto Cycle</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid of 6 primary telemetric sensors - One row on wide screens, two rows of three on laptops, two columns on phones */}
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-2 sm:gap-3 min-w-0">
        {/* 1. DPF Soot Accumulation */}
        <div className={`p-3 lg:p-2.5 xl:p-3.5 rounded-2xl xl:rounded-3xl border transition-all ${sootInfo.bg} ${sootInfo.border} min-w-0 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between text-[11px] xl:text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-medium truncate">
                <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">DPF Soot Mass</span>
              </span>
              <span className="hidden sm:inline font-mono text-[9px] xl:text-[10px] text-slate-400 shrink-0 ml-1">SPN 3719</span>
            </div>

            <div className="flex items-baseline gap-1 my-0.5 xl:my-1">
              <span className={`text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-bold font-mono ${sootInfo.color}`}>
                {sootVal.toFixed(1)}
              </span>
              <span className="text-xs xl:text-sm font-mono text-slate-400">g</span>
            </div>

            <div className="text-[9px] xl:text-[10px] font-semibold tracking-wider font-mono uppercase mb-2 truncate">
              <span className={sootInfo.color}>{sootInfo.label}</span>
            </div>
          </div>

          <div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-1.5 xl:h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  sootVal >= 28.0 ? 'bg-rose-500' : sootVal >= 18.0 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, (sootVal / 45) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 whitespace-nowrap text-[8px] sm:text-[9px] xl:text-[10px] text-slate-400 font-mono mt-1">
              <span className="hidden sm:inline">0g</span>
              <span className="text-slate-300">Norm: &lt;18g</span>
              <span className="hidden sm:inline">45g</span>
            </div>

            {isEditable && (
              <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={sootVal}
                  onChange={(e) => updateField('soot_level_g', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* 2. Coolant Temperature */}
        <div className={`p-3 lg:p-2.5 xl:p-3.5 rounded-2xl xl:rounded-3xl border transition-all ${coolantInfo.bg} ${coolantInfo.border} min-w-0 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between text-[11px] xl:text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-medium truncate">
                <Thermometer className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">Coolant Temp</span>
              </span>
              <span className="hidden sm:inline font-mono text-[9px] xl:text-[10px] text-slate-400 shrink-0 ml-1">SPN 110</span>
            </div>

            <div className="flex items-baseline gap-1 my-0.5 xl:my-1">
              <span className={`text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-bold font-mono ${coolantInfo.color}`}>
                {telemetry.coolant_temp_c}
              </span>
              <span className="text-xs xl:text-sm font-mono text-slate-400">°C</span>
            </div>

            <div className="text-[9px] xl:text-[10px] font-semibold tracking-wider font-mono uppercase mb-2 truncate">
              <span className={coolantInfo.color}>{coolantInfo.label}</span>
            </div>
          </div>

          <div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-1.5 xl:h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  telemetry.coolant_temp_c >= 105
                    ? 'bg-rose-500'
                    : telemetry.coolant_temp_c >= 98
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(10, ((telemetry.coolant_temp_c - 60) / 70) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 whitespace-nowrap text-[8px] sm:text-[9px] xl:text-[10px] text-slate-400 font-mono mt-1">
              <span className="hidden sm:inline">60°C</span>
              <span className="text-slate-300">Norm: 82-95°C</span>
              <span className="hidden sm:inline">130°C</span>
            </div>

            {isEditable && (
              <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                <input
                  type="range"
                  min="60"
                  max="130"
                  value={telemetry.coolant_temp_c}
                  onChange={(e) => updateField('coolant_temp_c', parseInt(e.target.value))}
                  className="w-full accent-rose-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. Battery Voltage (24V Bus) */}
        <div className={`p-3 lg:p-2.5 xl:p-3.5 rounded-2xl xl:rounded-3xl border transition-all ${voltageInfo.bg} ${voltageInfo.border} min-w-0 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between text-[11px] xl:text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-medium truncate">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Bus Voltage</span>
              </span>
              <span className="hidden sm:inline font-mono text-[9px] xl:text-[10px] text-slate-400 shrink-0 ml-1">SPN 168</span>
            </div>

            <div className="flex items-baseline gap-1 my-0.5 xl:my-1">
              <span className={`text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-bold font-mono ${voltageInfo.color}`}>
                {telemetry.battery_voltage_v.toFixed(1)}
              </span>
              <span className="text-xs xl:text-sm font-mono text-slate-400">V</span>
            </div>

            <div className="text-[9px] xl:text-[10px] font-semibold tracking-wider font-mono uppercase mb-2 truncate">
              <span className={voltageInfo.color}>{voltageInfo.label}</span>
            </div>
          </div>

          <div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-1.5 xl:h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  telemetry.battery_voltage_v < 23.5
                    ? 'bg-rose-500'
                    : telemetry.battery_voltage_v < 25.5
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(10, ((telemetry.battery_voltage_v - 18) / 14) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 whitespace-nowrap text-[8px] sm:text-[9px] xl:text-[10px] text-slate-400 font-mono mt-1">
              <span className="hidden sm:inline">18V</span>
              <span className="text-slate-300">Norm: 27.5V</span>
              <span className="hidden sm:inline">32V</span>
            </div>

            {isEditable && (
              <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                <input
                  type="range"
                  min="180"
                  max="320"
                  value={Math.round(telemetry.battery_voltage_v * 10)}
                  onChange={(e) => updateField('battery_voltage_v', parseInt(e.target.value) / 10)}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* 4. Engine Load */}
        <div className="p-3 lg:p-2.5 xl:p-3.5 rounded-2xl xl:rounded-3xl border calm-tile min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[11px] xl:text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-medium truncate">
                <Gauge className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">Engine Load</span>
              </span>
              <span className="hidden sm:inline font-mono text-[9px] xl:text-[10px] text-slate-400 shrink-0 ml-1">SPN 92</span>
            </div>

            <div className="flex items-baseline gap-1 my-0.5 xl:my-1">
              <span className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-bold font-mono text-slate-100">
                {telemetry.engine_load_pct}
              </span>
              <span className="text-xs xl:text-sm font-mono text-slate-400">%</span>
            </div>

            <div className="text-[9px] xl:text-[10px] font-semibold tracking-wider font-mono uppercase mb-2 truncate">
              <span className={loadInfo.color}>{loadInfo.label}</span>
            </div>
          </div>

          <div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-1.5 xl:h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full transition-all duration-300 bg-gradient-to-r from-cyan-500 to-amber-500"
                style={{ width: `${Math.min(100, Math.max(5, telemetry.engine_load_pct))}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 whitespace-nowrap text-[8px] sm:text-[9px] xl:text-[10px] text-slate-400 font-mono mt-1">
              <span className="hidden sm:inline">0%</span>
              <span>Norm: 30-70%</span>
              <span className="hidden sm:inline">100%</span>
            </div>

            {isEditable && (
              <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={telemetry.engine_load_pct}
                  onChange={(e) => updateField('engine_load_pct', parseInt(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* 5. Exhaust Pyrometer (EGT) */}
        <div className={`p-3 lg:p-2.5 xl:p-3.5 rounded-2xl xl:rounded-3xl border transition-all ${exhaustInfo.bg} ${exhaustInfo.border} min-w-0 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between text-[11px] xl:text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-medium truncate">
                <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">Exhaust Temp</span>
              </span>
              <span className="hidden sm:inline font-mono text-[9px] xl:text-[10px] text-slate-400 shrink-0 ml-1">SPN 173</span>
            </div>

            <div className="flex items-baseline gap-1 my-0.5 xl:my-1">
              <span className={`text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-bold font-mono ${exhaustInfo.color}`}>
                {telemetry.exhaust_temp_c}
              </span>
              <span className="text-xs xl:text-sm font-mono text-slate-400">°C</span>
            </div>

            <div className="text-[9px] xl:text-[10px] font-semibold tracking-wider font-mono uppercase mb-2 truncate">
              <span className={exhaustInfo.color}>{exhaustInfo.label}</span>
            </div>
          </div>

          <div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-1.5 xl:h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  telemetry.exhaust_temp_c >= 620
                    ? 'bg-rose-500'
                    : telemetry.exhaust_temp_c >= 520
                    ? 'bg-orange-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(10, ((telemetry.exhaust_temp_c - 150) / 650) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 whitespace-nowrap text-[8px] sm:text-[9px] xl:text-[10px] text-slate-400 font-mono mt-1">
              <span className="hidden sm:inline">150°C</span>
              <span className="text-slate-300">Norm: 320-480°C</span>
              <span className="hidden sm:inline">800°C</span>
            </div>

            {isEditable && (
              <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                <input
                  type="range"
                  min="150"
                  max="800"
                  value={telemetry.exhaust_temp_c}
                  onChange={(e) => updateField('exhaust_temp_c', parseInt(e.target.value))}
                  className="w-full accent-orange-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* 6. NOx Sensor Concentration */}
        <div className={`p-3 lg:p-2.5 xl:p-3.5 rounded-2xl xl:rounded-3xl border transition-all ${noxInfo.bg} ${noxInfo.border} min-w-0 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between text-[11px] xl:text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-medium truncate">
                <Wind className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">NOx Sensor</span>
              </span>
              <span className="hidden sm:inline font-mono text-[9px] xl:text-[10px] text-slate-400 shrink-0 ml-1">SPN 3216</span>
            </div>

            <div className="flex items-baseline gap-1 my-0.5 xl:my-1">
              <span className={`text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-bold font-mono ${noxInfo.color}`}>
                {telemetry.nox_sensor_ppm}
              </span>
              <span className="text-xs xl:text-sm font-mono text-slate-400">PPM</span>
            </div>

            <div className="text-[9px] xl:text-[10px] font-semibold tracking-wider font-mono uppercase mb-2 truncate">
              <span className={noxInfo.color}>{noxInfo.label}</span>
            </div>
          </div>

          <div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-1.5 xl:h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  telemetry.nox_sensor_ppm >= 1000
                    ? 'bg-rose-500'
                    : telemetry.nox_sensor_ppm >= 350
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(10, (telemetry.nox_sensor_ppm / 2000) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 whitespace-nowrap text-[8px] sm:text-[9px] xl:text-[10px] text-slate-400 font-mono mt-1">
              <span className="hidden sm:inline">0 PPM</span>
              <span className="text-slate-300">Norm: &lt;150</span>
              <span className="hidden sm:inline">2000 PPM</span>
            </div>

            {isEditable && (
              <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="10"
                  value={telemetry.nox_sensor_ppm}
                  onChange={(e) => updateField('nox_sensor_ppm', parseInt(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Road Dynamics, Speed, Tachometer (Engine & Wheel RPM) & Radial Tire TPMS Sub-Cluster */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <h3 className="uppercase tracking-wider font-bold text-slate-200 flex items-center gap-1.5">
              <CircleDot className="w-3.5 h-3.5 text-amber-400" />
              Road Dynamics, Speed, Tachometer & TPMS
            </h3>
            <span className="text-[10px] text-slate-500 hidden sm:inline">• SAE J1939 Powertrain & Wheel Telematics</span>
          </div>

          {/* RPM Mode Selector Option */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-[11px]">
            <span className="text-slate-500 px-1.5 font-sans font-medium text-[10px] uppercase">RPM Option:</span>
            <button
              onClick={() => setRpmDisplayMode('BOTH')}
              className={`px-2.5 py-0.5 rounded-xl font-semibold transition-all ${
                rpmDisplayMode === 'BOTH'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Both (Engine & Wheels)
            </button>
            <button
              onClick={() => setRpmDisplayMode('ENGINE')}
              className={`px-2.5 py-0.5 rounded-xl font-semibold transition-all ${
                rpmDisplayMode === 'ENGINE'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Engine RPM
            </button>
            <button
              onClick={() => setRpmDisplayMode('WHEELS')}
              className={`px-2.5 py-0.5 rounded-xl font-semibold transition-all ${
                rpmDisplayMode === 'WHEELS'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              On Wheels RPM
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-12 gap-2 sm:gap-3">
          {/* Card 1: Speed in KMPH & MPH + Vehicle Torque Measurements (Col 4 on lg) */}
          <div className="2xl:col-span-4 p-3 sm:p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-3">
            {/* Upper Section: Road Speed */}
            <div>
              <div className="flex justify-between items-center text-xs text-slate-400 font-mono mb-1">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  Road Speed
                </span>
                <span className="text-[10px] text-slate-400 font-mono">SPN 84</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-slate-100">
                  {speedKmh}
                </span>
                <span className="text-xs font-mono text-amber-400 font-bold">KMPH</span>
                <span className="text-xs font-mono text-slate-500">
                  ({Math.round(speedKmh / 1.60934)} MPH)
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center justify-between">
                <span>Norm: 0 - 80 KMPH</span>
                <span className="text-amber-400/90 font-medium">Gov. Limit: 80 km/h</span>
              </div>
            </div>

            {/* Middle Section: Vehicle Torque Measurements (SAE J1939 EEC1 SPN 513) */}
            {(() => {
              const hasDtc = Boolean(telemetry.active_dtc_codes && telemetry.active_dtc_codes.length > 0);
              const deratePct = telemetry.torque_derate_pct ?? (hasDtc ? 25 : 0);
              const torquePct = telemetry.torque_pct ?? Math.min(100, Math.max(12, Math.round((telemetry.engine_load_pct ?? 50) * (1 - deratePct / 100))));
              const torqueNm = telemetry.actual_torque_nm ?? Math.round((torquePct / 100) * 1100);
              const torqueLbFt = Math.round(torqueNm * 0.73756);

              return (
                <div className="pt-2.5 border-t border-slate-800/90 space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      Vehicle Torque
                    </span>
                    <div className="flex items-center gap-1.5">
                      {deratePct > 0 && (
                        <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                          -{deratePct}% DERATE
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">SPN 513</span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black font-mono text-cyan-300">
                        {torqueNm}
                      </span>
                      <span className="text-xs font-mono text-cyan-400 font-bold">NM</span>
                      <span className="text-xs font-mono text-slate-500">
                        ({torqueLbFt} lb-ft)
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                      {torquePct}% <span className="text-[9px] text-slate-500">LOAD</span>
                    </span>
                  </div>

                  {/* Visual Torque Bar */}
                  <div className="space-y-1">
                    <div className="relative h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          deratePct > 0
                            ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                            : torquePct > 85
                            ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                            : 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, torquePct))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] font-mono text-slate-500">
                      <span>0 Nm Idle</span>
                      <span className="text-emerald-400 font-semibold">Peak 1100 Nm</span>
                      <span className={deratePct > 0 ? 'text-amber-400' : 'text-slate-400'}>
                        {deratePct > 0 ? 'Derated: 825 Nm Max' : 'Class 8 / BSVI'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Live Speed & Road Dynamics Telematics Stream */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Live Ground Speed Stream
                </span>
                <span className="text-slate-400">{telemetry.speed_mph || Math.round(speedKmh / 1.60934)} MPH</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-500">
                <span>CAN Bus SPN 84</span>
                <span className="text-amber-400/90 font-medium">Gov Limit: 80 km/h</span>
              </div>
            </div>
          </div>

          {/* Card 2: Tachometer & RPM Cluster (Engine RPM & On Wheels RPM) (Col 5 on lg) */}
          <div className={`lg:col-span-2 lg:order-first 2xl:order-none 2xl:col-span-5 p-3 sm:p-3.5 rounded-2xl transition-all duration-300 flex flex-col justify-between space-y-2.5 ${
            isExceededOptimal
              ? 'bg-rose-950/20 border border-rose-500/60 shadow-[0_0_25px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/30'
              : 'bg-slate-950/70 border border-slate-800'
          }`}>
            <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <RotateCw className={`w-3.5 h-3.5 transition-colors ${isExceededOptimal ? 'text-rose-400' : 'text-amber-400'}`} />
                Drivetrain Tachometer & RPMs
              </span>
              <div className="flex items-center gap-2">
                {isExceededOptimal && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[9px] font-bold font-mono animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                    EXCEEDS OPTIMAL
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-mono">
                  {rpmDisplayMode === 'BOTH' ? 'SPN 190 & SPN 904' : rpmDisplayMode === 'ENGINE' ? 'SPN 190' : 'SPN 904'}
                </span>
              </div>
            </div>

            {/* Render based on rpmDisplayMode */}
            {rpmDisplayMode === 'BOTH' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Engine RPM Sub-Panel */}
                <div className={`p-2.5 rounded-2xl transition-all duration-300 flex flex-col justify-between space-y-2 ${
                  isExceededOptimal
                    ? 'bg-rose-950/30 border border-rose-500/80 shadow-[0_0_22px_rgba(244,63,94,0.45)] ring-1 ring-rose-500/50'
                    : isOptimalRpm
                    ? 'bg-slate-900/90 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'bg-slate-900/80 border border-slate-800/90'
                }`}>
                  <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                    <span className={`font-semibold flex items-center gap-1 ${isExceededOptimal ? 'text-rose-300' : isOptimalRpm ? 'text-emerald-300' : 'text-amber-300'}`}>
                      <Activity className={`w-3 h-3 ${isExceededOptimal ? 'text-rose-400 animate-pulse' : isOptimalRpm ? 'text-emerald-400' : 'text-amber-400'}`} />
                      Engine RPM
                    </span>
                    <span className="text-[9px] text-slate-500">Crankshaft (SPN 190)</span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl font-black font-mono transition-colors ${
                        isExceededOptimal
                          ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.9)]'
                          : isOptimalRpm
                          ? 'text-emerald-300'
                          : 'text-slate-100'
                      }`}>
                        {engineRpm.toLocaleString()}
                      </span>
                      <span className={`text-xs font-mono font-bold ${isExceededOptimal ? 'text-rose-400' : 'text-amber-400'}`}>RPM</span>
                    </div>

                    {/* Operating state indicator pill */}
                    {isExceededOptimal ? (
                      <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-xl bg-rose-500/25 text-rose-200 border border-rose-500/60 shadow-[0_0_10px_rgba(244,63,94,0.5)] font-bold animate-pulse">
                        <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                        {isCriticalRedline ? 'REDLINE RISK' : 'EXCEEDS OPTIMAL'}
                      </span>
                    ) : isOptimalRpm ? (
                      <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)] font-semibold">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        OPTIMAL BAND
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-xl bg-slate-800/80 text-slate-400 border border-slate-700">
                        {engineRpmInfo.zone}
                      </span>
                    )}
                  </div>

                  <div className="text-[9px] font-mono font-medium flex justify-between items-center">
                    <span className={engineRpmInfo.color}>{engineRpmInfo.label}</span>
                    <span className="text-slate-500 text-[8px] whitespace-nowrap shrink-0 ml-2">Range: 0-2500</span>
                  </div>

                  {/* Visual Threshold Indicators Gauge Bar */}
                  <div className="space-y-1">
                    {/* Multi-Zone Threshold Track */}
                    <div className={`relative h-3 w-full bg-slate-950 rounded-full overflow-hidden border p-0.5 transition-all duration-300 ${
                      isExceededOptimal
                        ? 'border-rose-500/70 shadow-[0_0_10px_rgba(244,63,94,0.35)]'
                        : 'border-slate-800'
                    }`}>
                      {/* Labeled Threshold Zones Layer */}
                      <div className="absolute inset-0 flex rounded-full overflow-hidden opacity-30 pointer-events-none">
                        {/* 0-600 RPM (24%): Low Idle */}
                        <div className="w-[24%] bg-slate-700 border-r border-slate-600/50" title="Low Idle Zone (<600 RPM)" />
                        {/* 600-1100 RPM (20%): Transition */}
                        <div className="w-[20%] bg-slate-600 border-r border-emerald-500/50" title="Warm Idle & Transition (600-1100 RPM)" />
                        {/* 1100-1500 RPM (16%): OPTIMAL OPERATING RANGE */}
                        <div className="w-[16%] bg-emerald-500 border-r border-rose-500/80" title="Optimal Range (1100-1500 RPM)" />
                        {/* 1500-1900 RPM (16%): Exceeds Optimal / High BSFC */}
                        <div className="w-[16%] bg-amber-500 border-r border-rose-600" title="Exceeds Optimal (1500-1900 RPM)" />
                        {/* 1900-2500 RPM (24%): Critical Redline */}
                        <div className="w-[24%] bg-rose-600" title="Redline Over-rev (>1900 RPM)" />
                      </div>

                      {/* Dynamic RPM Fill with Warning Glow */}
                      <div
                        className={`relative h-full rounded-full transition-all duration-300 ${
                          isExceededOptimal
                            ? 'bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.95)] animate-pulse'
                            : isOptimalRpm
                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                            : 'bg-amber-400'
                        }`}
                        style={{ width: `${engineRpmInfo.progress}%` }}
                      />

                      {/* Threshold Pin: 1100 RPM (Min Optimal: 44%) */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-emerald-400/90 pointer-events-none z-10"
                        style={{ left: '44%' }}
                        title="Optimal Minimum: 1100 RPM"
                      />

                      {/* Threshold Pin: 1500 RPM (MAX OPTIMAL LIMIT: 60%) */}
                      <div
                        className={`absolute top-0 bottom-0 w-1 pointer-events-none z-10 transition-colors ${
                          isExceededOptimal
                            ? 'bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,1)]'
                            : 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.8)]'
                        }`}
                        style={{ left: '60%' }}
                        title="Optimal Threshold Limit: 1500 RPM"
                      />

                      {/* Threshold Pin: 1900 RPM (Governor Limit: 76%) */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-10"
                        style={{ left: '76%' }}
                        title="Governor Redline: 1900 RPM"
                      />
                    </div>

                    {/* Visual Threshold Ticks & Indicator Labels */}
                    <div className="flex flex-wrap justify-between gap-x-3 text-[8px] font-mono text-slate-500 px-0.5 pt-0.5">
                      <span>0</span>
                      <span className="text-slate-400">800</span>
                      <span className={`font-bold transition-colors ${isOptimalRpm ? 'text-emerald-300 drop-shadow-[0_0_4px_rgba(16,185,129,0.8)]' : 'text-emerald-400'}`}>
                        1100-1500
                      </span>
                      <span className={`font-bold transition-colors ${
                        isExceededOptimal
                          ? 'text-rose-400 animate-pulse drop-shadow-[0_0_6px_rgba(244,63,94,0.9)]'
                          : 'text-amber-400'
                      }`}>
                        ▲ 1500 Limit
                      </span>
                      <span className="text-rose-500">1900+ Gov</span>
                    </div>
                  </div>

                  {/* Warning Glow Alert when Exceeding Optimal Range */}
                  {isExceededOptimal && (
                    <div className="p-1.5 rounded-xl bg-rose-500/20 border border-rose-500/60 flex items-start gap-1.5 text-[9px] font-mono text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                      <div className="leading-tight">
                        <span className="font-bold text-rose-300">THRESHOLD EXCEEDED: </span>
                        {engineRpm} RPM exceeds 1500 RPM optimal range. High fuel consumption & pyrometer heat.
                      </div>
                    </div>
                  )}

                  {/* Autonomous Live Engine Telemetry Status */}
                  <div className="flex items-center justify-between text-[9px] font-mono pt-1 border-t border-slate-800/80">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isExceededOptimal ? 'bg-rose-500 animate-ping' : isOptimalRpm ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                      }`} />
                      <span className={isExceededOptimal ? 'text-rose-300 font-semibold' : 'text-slate-300'}>
                        {isExceededOptimal ? 'Exceeds Optimal Threshold' : isOptimalRpm ? 'Live Stream: 1100–1500 Optimal' : 'Live Stream: Idle/Transition'}
                      </span>
                    </span>
                    <span className="text-slate-500">SPN 190</span>
                  </div>
                </div>

                {/* On Wheels RPM Sub-Panel */}
                <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                    <span className="font-semibold text-cyan-300 flex items-center gap-1">
                      <Disc className="w-3 h-3 text-cyan-400" />
                      On Wheels RPM
                    </span>
                    <span className="text-[9px] text-slate-500">Tire Rotation (SPN 904)</span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black font-mono text-cyan-300">
                        {wheelRpm}
                      </span>
                      <span className="text-xs font-mono text-cyan-400 font-bold">WHEEL RPM</span>
                    </div>

                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      {speedKmh} km/h
                    </span>
                  </div>

                  <div className="text-[9px] font-mono font-medium">
                    <span className={wheelRpmInfo.color}>{wheelRpmInfo.label}</span>
                  </div>

                  {/* Wheel RPM Visual Threshold Track */}
                  <div className="space-y-1">
                    <div className="relative h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                      <div className="absolute inset-0 flex rounded-full overflow-hidden opacity-25 pointer-events-none">
                        {/* 0-150 RPM (Yard) */}
                        <div className="w-[30%] bg-slate-700 border-r border-slate-600" />
                        {/* 150-320 RPM (City) */}
                        <div className="w-[34%] bg-cyan-600 border-r border-emerald-500" />
                        {/* 320-420 RPM (Highway Cruise Optimal) */}
                        <div className="w-[20%] bg-emerald-500 border-r border-rose-500" />
                        {/* 420+ (Over Speed) */}
                        <div className="w-[16%] bg-rose-600" />
                      </div>
                      <div
                        className="relative h-full bg-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                        style={{ width: `${Math.min(100, Math.max(0, (wheelRpm / 500) * 100))}%` }}
                      />
                      {/* Threshold Pin: 320 RPM (Highway cruise start: 64%) */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 pointer-events-none z-10"
                        style={{ left: '64%' }}
                        title="Highway Cruise Start: 320 RPM"
                      />
                      {/* Threshold Pin: 420 RPM (Gov Speed limit: 84%) */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-400 pointer-events-none z-10"
                        style={{ left: '84%' }}
                        title="Speed Limit Threshold: 420 RPM"
                      />
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3 text-[8px] font-mono text-slate-500 px-0.5">
                      <span>0 Rest</span>
                      <span className="text-cyan-400">150 City</span>
                      <span className="text-emerald-400 font-bold">320-420 Cruise</span>
                      <span className="text-rose-400">&gt;420 Limit</span>
                    </div>
                  </div>

                  <div className="text-[9px] font-mono text-slate-400 flex flex-col gap-0.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ratio (Eng/Whl):</span>
                      <span className="text-slate-200 font-bold">{gearRatio} : 1</span>
                    </div>
                  </div>

                  {/* Live Wheel Telematics Stream Info */}
                  <div className="flex items-center justify-between text-[9px] font-mono pt-1 border-t border-slate-800/80 text-slate-400">
                    <span className="flex items-center gap-1.5 text-cyan-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>4-Sensor ABS Live Synced</span>
                    </span>
                    <span className="text-slate-500">3.30m Rolling Cir.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Render ENGINE ONLY Mode */}
            {rpmDisplayMode === 'ENGINE' && (
              <div className={`p-3 sm:p-3.5 rounded-2xl transition-all duration-300 space-y-3 ${
                isExceededOptimal
                  ? 'bg-rose-950/30 border border-rose-500/80 shadow-[0_0_30px_rgba(244,63,94,0.45)] ring-1 ring-rose-500/50'
                  : isOptimalRpm
                  ? 'bg-slate-900/90 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'bg-slate-900/90 border border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl sm:text-4xl font-black font-mono transition-colors ${
                      isExceededOptimal
                        ? 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.9)]'
                        : isOptimalRpm
                        ? 'text-emerald-300'
                        : 'text-slate-100'
                    }`}>
                      {engineRpm.toLocaleString()}
                    </span>
                    <span className={`text-xs font-mono font-bold ${isExceededOptimal ? 'text-rose-400' : 'text-amber-400'}`}>
                      ENGINE RPM (SPN 190)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExceededOptimal ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-xl bg-rose-500/25 text-rose-200 border border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.5)] font-bold animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        {isCriticalRedline ? 'CRITICAL REDLINE OVER-REV' : 'EXCEEDS OPTIMAL RANGE'}
                      </span>
                    ) : isOptimalRpm ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        OPTIMAL SWEET SPOT (1100-1500)
                      </span>
                    ) : (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-xl border ${engineRpmInfo.color} border-slate-700 bg-slate-950`}>
                        {engineRpmInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Operating Range Bands Visual Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[9px] font-mono">
                  <div className={`p-1.5 rounded-xl text-center border ${
                    engineRpm < 600 ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold' : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}>
                    <div className="text-[8px] text-slate-500">ZONE 1</div>
                    <div>&lt; 600 RPM</div>
                    <div className="text-[8px] text-slate-400">Low / Stall Idle</div>
                  </div>
                  <div className={`p-1.5 rounded-xl text-center border ${
                    engineRpm >= 600 && engineRpm < 1100 ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 font-bold' : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}>
                    <div className="text-[8px] text-slate-500">ZONE 2</div>
                    <div>600–1100 RPM</div>
                    <div className="text-[8px] text-slate-400">Warm Idle / Transition</div>
                  </div>
                  <div className={`p-1.5 rounded-xl text-center border ${
                    isOptimalRpm
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}>
                    <div className="text-[8px] text-emerald-400 font-bold">ZONE 3 (OPTIMAL)</div>
                    <div>1100–1500 RPM</div>
                    <div className="text-[8px] text-emerald-400/80">Peak Torque (1100 Nm)</div>
                  </div>
                  <div className={`p-1.5 rounded-xl text-center border ${
                    engineRpm > 1500 && engineRpm < 1900
                      ? 'bg-rose-500/25 border-rose-500/70 text-rose-300 font-bold shadow-[0_0_10px_rgba(244,63,94,0.35)] animate-pulse'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}>
                    <div className="text-[8px] text-rose-400 font-bold">ZONE 4 (EXCEEDED)</div>
                    <div>1500–1900 RPM</div>
                    <div className="text-[8px] text-rose-400/80">High BSFC & Thermal</div>
                  </div>
                  <div className={`p-1.5 rounded-xl text-center border ${
                    engineRpm >= 1900
                      ? 'bg-rose-600/30 border-rose-500 text-rose-200 font-bold shadow-[0_0_12px_rgba(244,63,94,0.5)] animate-pulse'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}>
                    <div className="text-[8px] text-rose-500 font-bold">ZONE 5 (REDLINE)</div>
                    <div>&gt; 1900 RPM</div>
                    <div className="text-[8px] text-rose-400">Governor Limit</div>
                  </div>
                </div>

                {/* Expanded Visual Threshold Track Bar */}
                <div className="space-y-1">
                  <div className={`relative h-4 w-full bg-slate-950 rounded-full overflow-hidden border p-0.5 transition-all duration-300 ${
                    isExceededOptimal
                      ? 'border-rose-500/80 shadow-[0_0_14px_rgba(244,63,94,0.4)]'
                      : 'border-slate-800'
                  }`}>
                    {/* Visual Segment Backgrounds */}
                    <div className="absolute inset-0 flex rounded-full overflow-hidden opacity-30 pointer-events-none">
                      <div className="w-[24%] bg-slate-700 border-r border-slate-600" />
                      <div className="w-[20%] bg-slate-600 border-r border-emerald-500" />
                      <div className="w-[16%] bg-emerald-500 border-r border-rose-500" />
                      <div className="w-[16%] bg-amber-500 border-r border-rose-600" />
                      <div className="w-[24%] bg-rose-600" />
                    </div>

                    {/* Active Dynamic Progress Fill */}
                    <div
                      className={`relative h-full rounded-full transition-all duration-300 ${
                        isExceededOptimal
                          ? 'bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,1)] animate-pulse'
                          : isOptimalRpm
                          ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${engineRpmInfo.progress}%` }}
                    />

                    {/* Visual Threshold Pins */}
                    {/* 1100 RPM (44%) */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 pointer-events-none z-10"
                      style={{ left: '44%' }}
                      title="Optimal Minimum: 1100 RPM"
                    />
                    {/* 1500 RPM (60%) THRESHOLD LIMIT */}
                    <div
                      className={`absolute top-0 bottom-0 w-1 pointer-events-none z-10 transition-colors ${
                        isExceededOptimal
                          ? 'bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,1)] animate-ping'
                          : 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                      }`}
                      style={{ left: '60%' }}
                      title="Optimal Maximum Threshold: 1500 RPM"
                    />
                    {/* 1900 RPM (76%) */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-10"
                      style={{ left: '76%' }}
                      title="Governor Redline: 1900 RPM"
                    />
                  </div>

                  {/* Threshold Indicators Legend */}
                  <div className="flex justify-between text-[9px] font-mono text-slate-500 px-1 pt-0.5">
                    <span>0 (Stop)</span>
                    <span className="text-slate-400">600 (Idle)</span>
                    <span className={`font-bold transition-colors ${isOptimalRpm ? 'text-emerald-300 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'text-emerald-400'}`}>
                      [ 1100 – 1500 RPM Optimal Operating Band ]
                    </span>
                    <span className={`font-bold transition-colors ${
                      isExceededOptimal
                        ? 'text-rose-400 animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,1)]'
                        : 'text-amber-400'
                    }`}>
                      ▲ 1500 Limit
                    </span>
                    <span className="text-rose-400">1900 (Gov)</span>
                    <span className="text-rose-500">2500 Redline</span>
                  </div>
                </div>

                {/* Exceeded Optimal Warning Banner with Actionable Advisory */}
                {isExceededOptimal && (
                  <div className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/70 text-rose-200 text-xs font-mono shadow-[0_0_20px_rgba(244,63,94,0.35)] animate-pulse flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-rose-100 flex items-center gap-1.5">
                          RPM Threshold Exceeded: Operating at {engineRpm} RPM
                          <span className="text-[10px] px-1.5 py-0.2 rounded-xl bg-rose-600/40 text-rose-200 border border-rose-500/60">
                            +{engineRpm - 1500} RPM Above Optimal
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-block text-[10px] bg-rose-500/30 px-2 py-1 rounded-xl text-rose-200 font-bold border border-rose-500/50">
                        ADVISORY: UPSHIFT / BACK OFF THROTTLE
                      </span>
                    </div>
                  </div>
                )}

                {/* Autonomous Live Telemetry Stream Indicator */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      isExceededOptimal ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'
                    }`} />
                    <span className="text-slate-300 font-medium">Real-Time Autonomous CAN Bus Stream</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Peak Torque: 1100–1500 RPM</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-rose-400">Warning Glow: &gt;1500 RPM</span>
                  </div>
                </div>
              </div>
            )}

            {/* Render WHEELS ONLY Mode */}
            {rpmDisplayMode === 'WHEELS' && (
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-cyan-300">
                      {wheelRpm}
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold">ON WHEELS RPM</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-xl border ${wheelRpmInfo.color} border-slate-700 bg-slate-950`}>
                    {wheelRpmInfo.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-950 p-2 rounded-2xl border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ground Speed:</span>
                    <span className="text-slate-100 font-bold">{speedKmh} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rev Frequency:</span>
                    <span className="text-cyan-300 font-bold">{(wheelRpm / 60).toFixed(2)} rev/sec</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tire Rolling Radius:</span>
                    <span className="text-slate-100">0.525 m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Coupling Ratio:</span>
                    <span className="text-amber-400 font-bold">{gearRatio} : 1</span>
                  </div>
                </div>

                {/* Autonomous Wheel Telemetry Stream Status */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-slate-300 font-medium">Dynamic Wheel Speed Telemetry Active</span>
                  </div>
                  <span className="text-cyan-300 font-mono">WSS Pulse: Synchronized</span>
                </div>
              </div>
            )}

            {/* Expandable 4-Corner Wheel Speed Sensors Breakdown */}
            <div className="pt-1.5 border-t border-slate-800/80">
              <button
                onClick={() => setShowWheelCorners(!showWheelCorners)}
                className="w-full flex items-center justify-between gap-3 text-[10px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-1 font-semibold">
                  <Disc className="w-3 h-3 text-amber-400" />
                  4-Corner Wheel Speed Sensors (WSS) Telemetry
                </span>
                <span className="flex items-center gap-0.5 text-slate-500">
                  {showWheelCorners ? (
                    <>
                      <span>Hide</span>
                      <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      <span>Inspect 4 Wheels</span>
                      <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </span>
              </button>

              {showWheelCorners && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono animate-fadeIn">
                  <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 font-bold">FL STEER</div>
                    <div className="text-slate-200 font-bold text-xs">{wheelRpm} <span className="text-[8px] text-slate-400">RPM</span></div>
                    <div className="text-[9px] text-cyan-400">{speedKmh} km/h</div>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 font-bold">FR STEER</div>
                    <div className="text-slate-200 font-bold text-xs">{wheelRpm} <span className="text-[8px] text-slate-400">RPM</span></div>
                    <div className="text-[9px] text-cyan-400">{speedKmh} km/h</div>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 font-bold">RL DRIVE</div>
                    <div className="text-slate-200 font-bold text-xs">{wheelRpm} <span className="text-[8px] text-slate-400">RPM</span></div>
                    <div className="text-[9px] text-cyan-400">{speedKmh} km/h</div>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 font-bold">RR DRIVE</div>
                    <div className="text-slate-200 font-bold text-xs">{wheelRpm} <span className="text-[8px] text-slate-400">RPM</span></div>
                    <div className="text-[9px] text-cyan-400">{speedKmh} km/h</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Tire Pressure & Radial TPMS (Col 3 on lg) */}
          <div className="2xl:col-span-3 p-3 sm:p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-2.5">
            <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1 font-semibold text-slate-200">
                <CircleDot className="w-3.5 h-3.5 text-amber-400" />
                Radial Tire Pressure & TPMS
              </span>
              <span className="text-[10px] text-slate-400">SPN 241</span>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black font-mono ${
                    tirePsi < 95 ? 'text-amber-400' : 'text-slate-100'
                  }`}
                >
                  {tirePsi}
                </span>
                <span className="text-xs font-mono text-slate-400">PSI</span>
                <span className="text-[11px] font-mono text-slate-400">
                  • Spec: 105 - 115 <strong className={tirePsi < 95 ? 'text-amber-400' : 'text-emerald-400'}>{tirePsi < 95 ? '(Low / Drag)' : '(Optimal)'}</strong>
                </span>
              </div>
              <button
                onClick={() => setIsTireModalOpen(true)}
                className="whitespace-nowrap shrink-0 text-[11px] font-mono px-2 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1 font-semibold"
                title="Open 10-wheel individual tire axle diagram"
              >
                TPMS Axle Matrix →
              </button>
            </div>

            {/* Individual Wheel Corner Buttons */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <span>Quick Wheel Position Select:</span>
                <span className="text-slate-500 text-[9px]">Tap position to inspect</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
                {(['FL', 'FR', 'RL', 'RR'] as const).map((pos) => {
                  const posPsi =
                    pos === 'FL'
                      ? tirePsi
                      : pos === 'FR'
                      ? Math.min(125, tirePsi + 2)
                      : pos === 'RL'
                      ? Math.max(65, tirePsi - 3)
                      : tirePsi;
                  return (
                    <button
                      key={pos}
                      onClick={() => {
                        setSelectedTireCorner(pos);
                        setIsTireModalOpen(true);
                      }}
                      className="p-1.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-center transition-colors group"
                      title={`Inspect individual ${pos} tire`}
                    >
                      <div className="text-[10px] text-slate-400 group-hover:text-amber-400 font-bold">{pos}</div>
                      <div className={`font-bold text-xs ${posPsi < 95 ? 'text-amber-400' : 'text-slate-200'}`}>
                        {posPsi} <span className="text-[9px] font-normal text-slate-500">PSI</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live TPMS Autonomous Telemetry Stream */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[10px] font-mono">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Radial Axle Pressure Sensors
                </span>
                <span className="text-emerald-400 font-bold">Cold Spec: 105-115 PSI</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 text-[9px] text-slate-500">
                <span>Dynamic Temperature Compensation</span>
                <span className="text-slate-400">All 10 Hub Sensors Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Tire PSI Manager Modal */}
      <TirePsiManagerModal
        isOpen={isTireModalOpen}
        onClose={() => setIsTireModalOpen(false)}
        telemetry={telemetry}
        onChangeTelemetry={onChangeTelemetry}
        vehicleId="FLEET-ACTIVE"
      />
    </div>
  );
};
