import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Package,
  TrendingDown,
  Printer,
  ShieldCheck,
  CheckSquare,
  Square,
  IndianRupee,
  Layers,
  Terminal,
  FileText,
} from 'lucide-react';
import { DiagnosticResult, VehicleSnapshot } from '../types';
import { downloadSynopsisPDF } from '../utils/generateSynopsisPDF';

interface DiagnosticSummaryProps {
  result: DiagnosticResult | null;
  snapshot: VehicleSnapshot;
  isLoading: boolean;
  onOpenWorkOrder: () => void;
}

export const DiagnosticSummary: React.FC<DiagnosticSummaryProps> = ({
  result,
  snapshot,
  isLoading,
  onOpenWorkOrder,
}) => {
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [procuredParts, setProcuredParts] = useState<Record<number, boolean>>({});

  const toggleStep = (index: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const togglePart = (index: number) => {
    setProcuredParts((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin flex items-center justify-center">
          <Wrench className="w-6 h-6 text-amber-400 animate-pulse" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100 font-display">
            Heavy-Duty Diagnostic AI Reasoning Active
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 font-mono">
            Correlating CAN bus telemetry, DPF soot mass, thermal loops, 24V bus delta, and active DTCs for {snapshot.vehicle_id}...
          </p>
        </div>
        <div className="flex justify-center flex-wrap gap-2 text-[11px] font-mono text-slate-400">
          <span className="px-2 py-0.5 rounded-xl bg-slate-800 border border-slate-700">Tata BSVI DTC Matrix</span>
          <span className="px-2 py-0.5 rounded-xl bg-slate-800 border border-slate-700">DPF Soot & Pyrometer Limits</span>
          <span className="px-2 py-0.5 rounded-xl bg-slate-800 border border-slate-700">Predictive Breakdown Risk</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
        <Wrench className="w-10 h-10 text-slate-600 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-300">No active AI diagnosis loaded</p>
        <p className="text-xs text-slate-400 mt-1">
          Click &quot;Analyze Telemetry&quot; above to run the Heavy-Duty Commercial Vehicle Diagnostic AI.
        </p>
      </div>
    );
  }

  const { health_score, status, primary_diagnosis, failure_probability_next_24h, required_parts, action_plan } = result;

  const isCritical = status === 'CRITICAL_STOP' || health_score < 50;
  const isWarning = status === 'WARNING';

  const completedStepsCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = action_plan.length > 0 ? Math.round((completedStepsCount / action_plan.length) * 100) : 0;

  // Estimated repair cost in INR based on health score and required parts
  const estimatedRepairCostInr = required_parts.length * 12500 + (isCritical ? 18000 : 7500);

  const sootGrams = snapshot.telemetry.soot_level_g ?? 24.5;
  const isHighSoot = sootGrams >= 28.0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3.5 sm:p-6 shadow-xl space-y-4 sm:space-y-6">
      {/* Top Banner: Status + Health Score + Failure Risk + Est Repair Cost (INR) */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-slate-800">
        {/* Left: Status and Vehicle Title */}
        <div className="space-y-2 w-full lg:flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {status === 'CRITICAL_STOP' ? (
              <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl text-[11px] sm:text-xs font-bold font-mono tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse shadow-sm shadow-rose-500/20">
                <AlertOctagon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                STATUS: CRITICAL_STOP
              </span>
            ) : status === 'WARNING' ? (
              <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl text-[11px] sm:text-xs font-bold font-mono tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50">
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                STATUS: WARNING
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl text-[11px] sm:text-xs font-bold font-mono tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                STATUS: HEALTHY
              </span>
            )}

            <span className="text-[10px] sm:text-xs font-mono text-slate-400">
              UNIT {snapshot.vehicle_id} • {snapshot.engine_hours.toLocaleString()} ENGINE HOURS
            </span>

            {/* Python 3 Diagnostic Engine Badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              <Terminal className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Python 3.10 Engine</span>
            </span>

            {/* Official Project Synopsis PDF Link */}
            <button
              onClick={() => downloadSynopsisPDF()}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="Download 2-Page Official Technical Synopsis PDF"
            >
              <FileText className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Synopsis (PDF)</span>
            </button>
          </div>

          <h3 className="text-sm sm:text-lg font-bold text-slate-100 leading-snug">
            {primary_diagnosis}
          </h3>
        </div>

        {/* Right: Health Score, 24h Failure Risk & Estimated Cost in INR */}
        <div className="grid grid-cols-3 gap-2 w-full lg:w-auto lg:flex lg:items-stretch lg:shrink-0 [&>*]:min-w-0">
          {/* Health Score Gauge Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-2 sm:p-3 text-center flex-1 lg:min-w-[116px]">
            <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5 whitespace-nowrap">
              Health Score
            </span>
            <div className="flex items-baseline justify-center gap-0.5 sm:gap-1">
              <span
                className={`text-lg sm:text-2xl lg:text-3xl font-black font-mono tracking-tight ${
                  health_score < 50
                    ? 'text-rose-400'
                    : health_score < 75
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {health_score}
              </span>
              <span className="text-[10px] sm:text-xs font-mono text-slate-400">/100</span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono font-medium text-slate-400 block mt-0.5 truncate">
              {health_score < 50 ? 'Critical' : health_score < 75 ? 'Caution' : 'Optimal'}
            </span>
          </div>

          {/* 24-Hour Failure Probability Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-2 sm:p-3 text-center flex-1 lg:min-w-[116px]">
            <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center justify-center gap-0.5 sm:gap-1">
              <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-400" />
              24h Risk
            </span>
            <div className="flex items-baseline justify-center gap-0.5">
              <span
                className={`text-lg sm:text-2xl lg:text-3xl font-black font-mono tracking-tight ${
                  failure_probability_next_24h >= 60
                    ? 'text-rose-400'
                    : failure_probability_next_24h >= 30
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {failure_probability_next_24h}
              </span>
              <span className="text-[10px] sm:text-xs font-mono text-slate-400">%</span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono font-medium text-slate-400 block mt-0.5 truncate">
              {failure_probability_next_24h >= 60 ? 'Roadside Risk' : 'Shop Sched'}
            </span>
          </div>

          {/* Estimated Repair Cost in INR (₹) */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-2 sm:p-3 text-center flex-1 lg:min-w-[168px] border-amber-500/30">
            <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-amber-400 block mb-0.5 flex items-center justify-center gap-0.5 sm:gap-1">
              <IndianRupee className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
              Est. Cost
            </span>
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="text-sm sm:text-xl lg:text-2xl font-black font-mono tracking-tight text-amber-300 whitespace-nowrap">
                ₹{estimatedRepairCostInr.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono font-medium text-slate-400 block mt-0.5 truncate">
              Tata OEM
            </span>
          </div>

          {/* Printable Ticket Shortcut */}
          <button
            onClick={onOpenWorkOrder}
            title="Generate Shop Work Order"
            className="flex flex-col sm:flex-col items-center justify-center p-2 sm:p-2.5 rounded-3xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/50 text-slate-300 hover:text-white transition-all text-[10px] sm:text-xs shrink-0 col-span-3 lg:col-span-1 mt-2 lg:mt-0"
          >
            <Printer className="w-4 h-4 text-amber-400 mb-0.5" />
            <span>Work Order</span>
          </button>
        </div>
      </div>

      {/* Scanned Diagnostic Trouble Codes (DTC) Section */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 font-display">
              Scanned Trouble Codes (DTC)
            </h4>
          </div>
          <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-800">
            {snapshot.telemetry.active_dtc_codes && snapshot.telemetry.active_dtc_codes.length > 0
              ? `${snapshot.telemetry.active_dtc_codes.length} Active Fault${snapshot.telemetry.active_dtc_codes.length > 1 ? 's' : ''} Scanned`
              : '0 Codes / Nominal ECU'}
          </span>
        </div>

        {snapshot.telemetry.active_dtc_codes && snapshot.telemetry.active_dtc_codes.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {snapshot.telemetry.active_dtc_codes.map((code) => (
              <div
                key={code}
                className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span>{code}</span>
                <span className="text-[10px] text-slate-400 font-normal border-l border-amber-500/30 pl-2">
                  {code.startsWith('P0192')
                    ? 'Common Rail Pressure Sensor Short'
                    : code.startsWith('P244') || code.startsWith('P246')
                    ? 'DPF Differential / Soot Restriction'
                    : code.startsWith('P220')
                    ? 'NOx Pre-DOC Sensor Circuit'
                    : code.startsWith('P2047')
                    ? 'DEF Doser Injector Valve'
                    : code.startsWith('P0118')
                    ? 'Coolant Temp High (ECT)'
                    : 'Active Powertrain DTC'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono py-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>ECU fault registry is clear. No active Diagnostic Trouble Codes detected on J1939 CAN-bus.</span>
          </div>
        )}
      </div>

      {/* DPF Soot Warning Banner if Soot is Elevated */}
      {isHighSoot && (
        <div className="p-3.5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-300">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="font-mono uppercase">DPF Soot Warning ({sootGrams.toFixed(1)} g):</strong>
              <span className="ml-1 text-slate-300">
                Soot accumulation exceeds the nominal 18.0g threshold. Stationary parked regeneration or 25% torque derate imminent.
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold shrink-0">
            SOOT REGEN ADVISORY
          </span>
        </div>
      )}

      {/* Main Analysis Body: Action Plan & Parts Requisition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Expected Plan of Action for Repairs */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-display">
                Expected Plan of Action for Repairs
              </h4>
            </div>

            <span className="text-xs font-mono text-slate-400">
              Progress: <strong className="text-amber-400">{completedStepsCount}</strong>/{action_plan.length} (
              {progressPercent}%)
            </span>
          </div>

          {/* Action steps list */}
          <div className="space-y-2.5">
            {action_plan.map((step, idx) => {
              const isChecked = !!completedSteps[idx];
              return (
                <div
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  className={`p-3 rounded-3xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isChecked
                      ? 'bg-slate-950/40 border-slate-800 text-slate-400 opacity-80'
                      : 'bg-slate-950/90 hover:bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    className="mt-0.5 text-amber-400 hover:text-amber-300 transition-colors focus:outline-none"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  <div className="flex-1 text-xs sm:text-sm leading-relaxed">
                    <span className="font-mono text-amber-400 font-bold mr-1.5">STEP {idx + 1}:</span>
                    <span className={isChecked ? 'line-through text-slate-400' : ''}>{step}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {isCritical && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p>
                <strong>Technician Safety Advisory:</strong> Do NOT remove coolant surge tank cap while engine is hot.
                Depressurize system and allow thermal stabilization before disconnecting 24V alternator bus or exhaust sensor harness.
              </p>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Required Parts Requisition */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-display">
                Required Replacement Parts (OEM)
              </h4>
            </div>

            <span className="text-xs font-mono text-slate-400">{required_parts.length} Items</span>
          </div>

          <div className="space-y-2">
            {required_parts.map((part, idx) => {
              const isProcured = !!procuredParts[idx];
              return (
                <div
                  key={idx}
                  onClick={() => togglePart(idx)}
                  className={`p-3 rounded-3xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isProcured
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-2xl flex items-center justify-center shrink-0 ${
                        isProcured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${isProcured ? 'text-emerald-300' : 'text-slate-200'}`}>
                        {part}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        Tata Genuine / Cummins BSVI Spec • {isProcured ? 'Allocated from Stock' : 'Requisition Pending'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-xl border shrink-0 ${
                      isProcured
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {isProcured ? 'Allocated' : 'Request'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick parts procurement trigger */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-medium">
              <span>Parts Inventory Link:</span>
              <span className="text-emerald-400 font-mono">Tata Motors e-Dukaan Online</span>
            </div>
            <button
              onClick={onOpenWorkOrder}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-mono text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              Generate Parts Requisition PO & Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
