import React, { useState, useEffect } from 'react';
import {
  X,
  Gauge,
  Sliders,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  TrendingDown,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { TelemetryData } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface TirePsiManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: TelemetryData;
  onChangeTelemetry: (updated: TelemetryData) => void;
  vehicleId: string;
}

export interface IndividualWheel {
  id: string;
  name: string;
  axle: 'Steer Axle' | 'Drive Axle 1' | 'Drive Axle 2';
  position: 'FL' | 'FR' | 'D1-LO' | 'D1-LI' | 'D1-RI' | 'D1-RO' | 'D2-LO' | 'D2-LI' | 'D2-RI' | 'D2-RO';
  psi: number;
  tempC: number;
  targetPsi: number;
}

export const TirePsiManagerModal: React.FC<TirePsiManagerModalProps> = ({
  isOpen,
  onClose,
  telemetry,
  onChangeTelemetry,
  vehicleId,
}) => {
  const currentBasePsi = telemetry.tire_pressure_psi ?? 84;

  // Initialize individual wheel states with slight realistic variance around the telemetry tire pressure
  const [wheels, setWheels] = useState<Record<string, { psi: number; tempC: number }>>(() => ({
    'FL': { psi: currentBasePsi, tempC: 44 },
    'FR': { psi: Math.min(125, currentBasePsi + 2), tempC: 45 },
    'D1-LO': { psi: Math.max(65, currentBasePsi - 3), tempC: 48 },
    'D1-LI': { psi: currentBasePsi, tempC: 51 },
    'D1-RI': { psi: currentBasePsi, tempC: 50 },
    'D1-RO': { psi: Math.min(125, currentBasePsi + 1), tempC: 47 },
    'D2-LO': { psi: currentBasePsi, tempC: 46 },
    'D2-LI': { psi: Math.max(65, currentBasePsi - 2), tempC: 49 },
    'D2-RI': { psi: currentBasePsi, tempC: 49 },
    'D2-RO': { psi: currentBasePsi, tempC: 45 },
  }));

  const [selectedWheelId, setSelectedWheelId] = useState<string>('FL');

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

  const targetSpec = 105;

  const updateWheelPsi = (pos: string, newPsi: number) => {
    const clamped = Math.max(60, Math.min(130, newPsi));
    const nextWheels = {
      ...wheels,
      [pos]: {
        ...wheels[pos],
        psi: clamped,
      },
    };
    setWheels(nextWheels);

    // Recompute fleet average tire pressure for telemetry sync
    const allValues = (Object.values(nextWheels) as Array<{ psi: number; tempC: number }>).map((w) => w.psi);
    const avg = Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length);
    onChangeTelemetry({
      ...telemetry,
      tire_pressure_psi: avg,
    });
  };

  const applyTargetToAll = (targetValue: number) => {
    const updated: Record<string, { psi: number; tempC: number }> = {};
    Object.keys(wheels).forEach((key) => {
      updated[key] = {
        ...wheels[key],
        psi: targetValue,
      };
    });
    setWheels(updated);
    onChangeTelemetry({
      ...telemetry,
      tire_pressure_psi: targetValue,
    });
  };

  const getTireStatus = (psi: number) => {
    if (psi < 80) return { label: 'CRITICAL UNDERINFLATION', color: 'text-rose-400', bg: 'bg-rose-500/20 border-rose-500/50', badge: 'bg-rose-500' };
    if (psi < 95) return { label: 'ROLLING DRAG / LOW', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/50', badge: 'bg-amber-500' };
    if (psi > 120) return { label: 'OVERINFLATED RISK', color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/50', badge: 'bg-purple-500' };
    return { label: 'NOMINAL COLD SPEC', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/50', badge: 'bg-emerald-500' };
  };

  const currentSelectedWheel = wheels[selectedWheelId] || { psi: currentBasePsi, tempC: 45 };
  const currentStatus = getTireStatus(currentSelectedWheel.psi);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 relative my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-3xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-display">
                Commercial Heavy-Duty Axle TPMS & Tire Pressure Controls
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Individual tire inflation adjustment for Unit {vehicleId} • 10-Wheel Dual Axle Configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Batch Inflation Actions:</span>
            <button
              onClick={() => applyTargetToAll(105)}
              className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold transition-colors"
            >
              Inflate All to 105 PSI (Target)
            </button>
            <button
              onClick={() => applyTargetToAll(110)}
              className="px-2.5 py-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-xs font-mono font-semibold transition-colors"
            >
              Set 110 PSI (Cold Spec)
            </button>
            <button
              onClick={() => applyTargetToAll(84)}
              className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold transition-colors"
            >
              Inject 84 PSI (Underinflated)
            </button>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Current Fleet Telemetry: <strong className="text-amber-400">{telemetry.tire_pressure_psi ?? 84} PSI</strong>
          </div>
        </div>

        {/* Interactive Truck Chassis Diagram with Individual Tire Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Chassis Visual Map with individual buttons */}
          <div className="md:col-span-7 bg-slate-950/80 border border-slate-800 rounded-3xl p-4 flex flex-col items-center justify-center relative">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>Click Any Individual Tire to Adjust Pressure</span>
            </div>

            {/* Simulated Heavy Vehicle Chassis Diagram */}
            <div className="w-full max-w-xs relative py-4 space-y-6">
              {/* Front Steer Axle */}
              <div className="relative">
                <div className="text-[10px] text-center font-mono text-slate-500 mb-1">FRONT STEER AXLE</div>
                <div className="flex items-center justify-between relative">
                  {/* Steer Left (FL) Button */}
                  <button
                    onClick={() => setSelectedWheelId('FL')}
                    className={`w-16 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                      selectedWheelId === 'FL' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                    } ${getTireStatus(wheels['FL'].psi).bg}`}
                  >
                    <span className="text-[10px] font-mono text-slate-400 font-bold">FL</span>
                    <span className="text-sm font-black font-mono text-slate-100">{wheels['FL'].psi}</span>
                    <span className="text-[9px] font-mono text-slate-400">PSI</span>
                  </button>

                  {/* Axle Line */}
                  <div className="flex-1 h-1.5 bg-slate-700 mx-2 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-xl-full bg-slate-800 border border-slate-600" />
                  </div>

                  {/* Steer Right (FR) Button */}
                  <button
                    onClick={() => setSelectedWheelId('FR')}
                    className={`w-16 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                      selectedWheelId === 'FR' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                    } ${getTireStatus(wheels['FR'].psi).bg}`}
                  >
                    <span className="text-[10px] font-mono text-slate-400 font-bold">FR</span>
                    <span className="text-sm font-black font-mono text-slate-100">{wheels['FR'].psi}</span>
                    <span className="text-[9px] font-mono text-slate-400">PSI</span>
                  </button>
                </div>
              </div>

              {/* Drive Axle 1 (Duals) */}
              <div className="relative">
                <div className="text-[10px] text-center font-mono text-slate-500 mb-1">DRIVE AXLE 1 (DUAL WHEELS)</div>
                <div className="flex items-center justify-between relative">
                  {/* Left Duals */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedWheelId('D1-LO')}
                      title="Drive 1 Left Outer"
                      className={`w-12 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        selectedWheelId === 'D1-LO' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                      } ${getTireStatus(wheels['D1-LO'].psi).bg}`}
                    >
                      <span className="text-[9px] font-mono text-slate-400">LO</span>
                      <span className="text-xs font-black font-mono text-slate-100">{wheels['D1-LO'].psi}</span>
                    </button>
                    <button
                      onClick={() => setSelectedWheelId('D1-LI')}
                      title="Drive 1 Left Inner"
                      className={`w-12 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        selectedWheelId === 'D1-LI' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                      } ${getTireStatus(wheels['D1-LI'].psi).bg}`}
                    >
                      <span className="text-[9px] font-mono text-slate-400">LI</span>
                      <span className="text-xs font-black font-mono text-slate-100">{wheels['D1-LI'].psi}</span>
                    </button>
                  </div>

                  {/* Axle Line Differential */}
                  <div className="flex-1 h-2 bg-slate-700 mx-1.5 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-xl-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-xl-full bg-amber-400" />
                    </div>
                  </div>

                  {/* Right Duals */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedWheelId('D1-RI')}
                      title="Drive 1 Right Inner"
                      className={`w-12 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        selectedWheelId === 'D1-RI' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                      } ${getTireStatus(wheels['D1-RI'].psi).bg}`}
                    >
                      <span className="text-[9px] font-mono text-slate-400">RI</span>
                      <span className="text-xs font-black font-mono text-slate-100">{wheels['D1-RI'].psi}</span>
                    </button>
                    <button
                      onClick={() => setSelectedWheelId('D1-RO')}
                      title="Drive 1 Right Outer"
                      className={`w-12 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        selectedWheelId === 'D1-RO' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                      } ${getTireStatus(wheels['D1-RO'].psi).bg}`}
                    >
                      <span className="text-[9px] font-mono text-slate-400">RO</span>
                      <span className="text-xs font-black font-mono text-slate-100">{wheels['D1-RO'].psi}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Drive Axle 2 (Duals) */}
              <div className="relative">
                <div className="text-[10px] text-center font-mono text-slate-500 mb-1">DRIVE AXLE 2 (TANDEM BOGIE)</div>
                <div className="flex items-center justify-between relative">
                  {/* Left Duals */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedWheelId('D2-LO')}
                      title="Drive 2 Left Outer"
                      className={`w-12 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        selectedWheelId === 'D2-LO' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                      } ${getTireStatus(wheels['D2-LO'].psi).bg}`}
                    >
                      <span className="text-[9px] font-mono text-slate-400">LO</span>
                      <span className="text-xs font-black font-mono text-slate-100">{wheels['D2-LO'].psi}</span>
                    </button>
                    <button
                      onClick={() => setSelectedWheelId('D2-LI')}
                      title="Drive 2 Left Inner"
                      className={`w-12 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        selectedWheelId === 'D2-LI' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                      } ${getTireStatus(wheels['D2-LI'].psi).bg}`}
                    >
                      <span className="text-[9px] font-mono text-slate-400">LI</span>
                      <span className="text-xs font-black font-mono text-slate-100">{wheels['D2-LI'].psi}</span>
                    </button>
                  </div>

                  {/* Axle Line Differential */}
                  <div className="flex-1 h-2 bg-slate-700 mx-1.5 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-xl-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-xl-full bg-amber-400" />
                    </div>
                  </div>

                  {/* Right Duals */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedWheelId('D2-RI')}
                      title="Drive 2 Right Inner"
                      className={`w-12 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        selectedWheelId === 'D2-RI' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                      } ${getTireStatus(wheels['D2-RI'].psi).bg}`}
                    >
                      <span className="text-[9px] font-mono text-slate-400">RI</span>
                      <span className="text-xs font-black font-mono text-slate-100">{wheels['D2-RI'].psi}</span>
                    </button>
                    <button
                      onClick={() => setSelectedWheelId('D2-RO')}
                      title="Drive 2 Right Outer"
                      className={`w-12 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        selectedWheelId === 'D2-RO' ? 'ring-2 ring-amber-400 border-amber-400 scale-105' : ''
                      } ${getTireStatus(wheels['D2-RO'].psi).bg}`}
                    >
                      <span className="text-[9px] font-mono text-slate-400">RO</span>
                      <span className="text-xs font-black font-mono text-slate-100">{wheels['D2-RO'].psi}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Wheel Adjuster Controls */}
          <div className="md:col-span-5 bg-slate-950/80 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 uppercase">Selected Wheel</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-xl border ${currentStatus.color} ${currentStatus.bg}`}>
                  {currentStatus.label}
                </span>
              </div>
              <h3 className="text-xl font-bold font-display text-slate-100 mt-1">
                Position: {selectedWheelId}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Sensor: SPN 241 / FMI 0 (TPMS Wireless Transponder)
              </p>
            </div>

            {/* Readout */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-3xl font-black font-mono text-slate-100">
                {currentSelectedWheel.psi} <span className="text-sm font-normal text-slate-400">PSI</span>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1 flex items-center justify-center gap-2">
                <span>Temp: {currentSelectedWheel.tempC}°C</span>
                <span>•</span>
                <span>Target: {targetSpec} PSI</span>
              </div>
            </div>

            {/* Individual Stepper Buttons */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-400">Individual Tire Buttons:</span>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => updateWheelPsi(selectedWheelId, currentSelectedWheel.psi - 5)}
                  className="py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700 transition-colors"
                >
                  -5 PSI
                </button>
                <button
                  onClick={() => updateWheelPsi(selectedWheelId, currentSelectedWheel.psi - 1)}
                  className="py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700 transition-colors"
                >
                  -1 PSI
                </button>
                <button
                  onClick={() => updateWheelPsi(selectedWheelId, currentSelectedWheel.psi + 1)}
                  className="py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700 transition-colors"
                >
                  +1 PSI
                </button>
                <button
                  onClick={() => updateWheelPsi(selectedWheelId, currentSelectedWheel.psi + 5)}
                  className="py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700 transition-colors"
                >
                  +5 PSI
                </button>
              </div>

              {/* Slider */}
              <div className="pt-2">
                <input
                  type="range"
                  min="65"
                  max="125"
                  value={currentSelectedWheel.psi}
                  onChange={(e) => updateWheelPsi(selectedWheelId, parseInt(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>65 PSI (Flat)</span>
                  <span>105 PSI (Target)</span>
                  <span>125 PSI (Max)</span>
                </div>
              </div>

              {/* Specific Individual Presets */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => updateWheelPsi(selectedWheelId, 105)}
                  className="py-1.5 px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-colors text-center"
                >
                  Set Target (105 PSI)
                </button>
                <button
                  onClick={() => updateWheelPsi(selectedWheelId, 84)}
                  className="py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold transition-colors text-center"
                >
                  Set Underinflated (84 PSI)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info and close */}
        <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Underinflated tires increase rolling resistance by up to 15%, reducing fuel economy by ~0.4 km/l.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-mono transition-colors shadow-md self-end sm:self-auto"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
