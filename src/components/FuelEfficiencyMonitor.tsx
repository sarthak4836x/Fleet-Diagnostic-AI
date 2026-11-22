import React from 'react';
import {
  Fuel,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Gauge,
  RefreshCw,
  Compass,
  Layers,
  IndianRupee,
} from 'lucide-react';
import { FuelEfficiencyResult, VehicleSnapshot, TelemetryData } from '../types';

interface FuelEfficiencyMonitorProps {
  snapshot: VehicleSnapshot;
  fuelResult: FuelEfficiencyResult | null;
  isLoading: boolean;
  onAnalyzeFuel: () => void;
  onViewJson: () => void;
  isEditable?: boolean;
  onChangeTelemetry?: (updated: TelemetryData) => void;
}

export const FuelEfficiencyMonitor: React.FC<FuelEfficiencyMonitorProps> = ({
  snapshot,
  fuelResult,
  isLoading,
  onAnalyzeFuel,
  onViewJson,
  isEditable,
  onChangeTelemetry,
}) => {
  // Fuel economy in km/l
  const currentKml =
    snapshot.telemetry.instant_kml ??
    fuelResult?.current_kml ??
    (snapshot.telemetry.instant_mpg ? Number((snapshot.telemetry.instant_mpg * 0.425144).toFixed(2)) : 5.2);

  const baselineKml = fuelResult?.baseline_expected_kml ?? 5.2;
  const kmlDelta = Number((currentKml - baselineKml).toFixed(2));

  // Fuel flow rate in L/h
  const fuelRateLph =
    snapshot.telemetry.fuel_rate_lph ??
    fuelResult?.fuel_rate_lph ??
    (snapshot.telemetry.fuel_rate_gph ? Number((snapshot.telemetry.fuel_rate_gph * 3.78541).toFixed(1)) : 42.4);

  // Speed in KMPH
  const speedKmh =
    snapshot.telemetry.speed_kmh ??
    (snapshot.telemetry.speed_mph ? Math.round(snapshot.telemetry.speed_mph * 1.60934) : 75);

  const tirePsi = snapshot.telemetry.tire_pressure_psi ?? 84;
  const sootGrams = snapshot.telemetry.soot_level_g ?? 24.5;

  // Monthly savings in INR
  const monthlySavingsInr =
    fuelResult?.estimated_monthly_savings_inr ??
    (fuelResult?.estimated_monthly_savings_usd ? fuelResult.estimated_monthly_savings_usd * 84 : 185000);

  const ratingColors = {
    OPTIMAL: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    FAIR: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    POOR: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    CRITICAL_WASTE: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  };

  const rating =
    fuelResult?.efficiency_rating || (currentKml < 3.8 ? 'CRITICAL_WASTE' : currentKml < 4.8 ? 'POOR' : 'FAIR');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col h-full space-y-4 sm:space-y-5 min-w-0">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-3xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100 font-display">
                Fuel Efficiency
              </h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-xl border ${ratingColors[rating]}`}>
                {rating.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              km/l penalty, DPF soot drag and diesel cost
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onViewJson}
            className="px-3 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
            title="Inspect structured JSON output"
          >
            <span className="font-bold text-amber-400">{`{ }`}</span>
            JSON
          </button>

          <button
            onClick={onAnalyzeFuel}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Analyzing…' : 'Analyze'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row (Updated to km/l, L/h, KMPH, INR ₹) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
        {/* Instant km/l */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>Instant Fuel Economy</span>
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-100">{currentKml}</span>
            <span className="text-xs text-amber-400 font-mono font-bold">km/l</span>
          </div>
          <div className="mt-2 text-[11px] font-mono flex items-center gap-1 text-rose-400">
            <TrendingDown className="w-3 h-3" />
            <span>
              {kmlDelta >= 0 ? `+${kmlDelta}` : kmlDelta} vs {baselineKml} km/l baseline
            </span>
          </div>
          {isEditable && onChangeTelemetry && (
            <div className="mt-2.5 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                <span>Update Economy</span>
                <span className="text-amber-400 font-bold">{currentKml} km/l</span>
              </div>
              <input
                type="range"
                min="15"
                max="80"
                step="1"
                value={Math.round(currentKml * 10)}
                onChange={(e) => {
                  const val = parseFloat((parseInt(e.target.value) / 10).toFixed(2));
                  onChangeTelemetry({
                    ...snapshot.telemetry,
                    instant_kml: val,
                    instant_mpg: parseFloat((val / 0.425144).toFixed(2)),
                  });
                }}
                className="w-full accent-amber-400 cursor-pointer"
                title="Update fuel economy"
              />
            </div>
          )}
        </div>

        {/* Fuel Flow Rate (L/h) */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>Fuel Burn Rate</span>
            <Fuel className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-100">{fuelRateLph}</span>
            <span className="text-xs text-rose-400 font-mono font-bold">L/h</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400">
            At {speedKmh} KMPH ({snapshot.telemetry.engine_load_pct}% engine load)
          </div>
          {isEditable && onChangeTelemetry && (
            <div className="mt-2.5 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                <span>Update Burn Rate</span>
                <span className="text-rose-400 font-bold">{fuelRateLph} L/h</span>
              </div>
              <input
                type="range"
                min="10"
                max="65"
                step="0.5"
                value={fuelRateLph}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onChangeTelemetry({
                    ...snapshot.telemetry,
                    fuel_rate_lph: val,
                    fuel_rate_gph: parseFloat((val / 3.78541).toFixed(1)),
                  });
                }}
                className="w-full accent-rose-400 cursor-pointer"
                title="Update fuel burn rate"
              />
            </div>
          )}
        </div>

        {/* DPF Soot & Tire Drag Factor */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-3.5 flex flex-col justify-between min-w-0">
          <div className="flex items-start justify-between text-slate-400 text-xs font-mono mb-1 gap-2">
            <span className="break-words line-clamp-2">DPF Soot & Tire Drag</span>
            <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={`text-xl sm:text-2xl font-black font-mono ${sootGrams >= 28 ? 'text-rose-400' : 'text-amber-400'}`}>
              {sootGrams.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">g Soot</span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-300 font-mono">{tirePsi} PSI</span>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] font-mono text-amber-400/90 leading-tight">
            {sootGrams >= 28 ? 'High backpressure penalty' : 'Normal exhaust restriction'}
          </div>
        </div>

        {/* Potential Monthly Diesel Savings in INR (₹) */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-3.5 flex flex-col justify-between border-amber-500/30 min-w-0">
          <div className="flex items-start justify-between text-amber-400 text-xs font-mono mb-1 gap-2">
            <span className="break-words line-clamp-2">Potential Monthly Diesel Savings</span>
            <IndianRupee className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          </div>
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400 truncate">
              ₹{monthlySavingsInr.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">/ mo</span>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] font-mono text-slate-400 leading-tight">
            Based on 12,000 km @ ₹94.50/L
          </div>
        </div>
      </div>

      {/* Deviations & Root Causes */}
      <div className="space-y-3 flex-1 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            Identified Factors Affecting Fuel Economy (km/l Drag)
          </h4>
          <span className="text-[11px] font-mono text-slate-400">
            {fuelResult?.potential_causes?.length || 0} factors correlated
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
          {(fuelResult?.potential_causes || []).map((cause, idx) => {
            const displayImpact =
              cause.impact_kml ?? (cause.impact_mpg ? Number((cause.impact_mpg * 0.425144).toFixed(2)) : 0.4);

            return (
              <div
                key={idx}
                className="p-3.5 rounded-3xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-slate-200 font-display">
                    {cause.factor}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-xl shrink-0 ${
                      cause.severity === 'SEVERE'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    -{displayImpact} km/l
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  {cause.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actionable Recommendations for Workshop & Fleet */}
      <div className="p-4 rounded-3xl bg-slate-950/90 border border-slate-800 flex-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono mb-3 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Actionable Fleet & Workshop Recommendations (Cost Optimization)
        </h4>

        <div className="space-y-2">
          {(fuelResult?.actionable_recommendations || []).map((rec, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
              <span className="w-5 h-5 rounded-xl bg-amber-400/20 text-amber-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="leading-relaxed font-sans">{rec}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
