import React, { useState } from 'react';
import {
  CalendarClock,
  Wrench,
  History,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  IndianRupee,
  Clock,
  TrendingUp,
  FileText,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Calculator,
} from 'lucide-react';
import { PredictiveMaintenanceResult, FleetVehicle, VehicleSnapshot } from '../types';
import { ServiceCostEstimator } from './ServiceCostEstimator';

interface PredictiveMaintenancePanelProps {
  snapshot: VehicleSnapshot;
  vehicleMeta?: FleetVehicle;
  predictiveResult: PredictiveMaintenanceResult | null;
  isLoading: boolean;
  onAnalyzePredictive: () => void;
  onViewJson: () => void;
}

export const PredictiveMaintenancePanel: React.FC<PredictiveMaintenancePanelProps> = ({
  snapshot,
  vehicleMeta,
  predictiveResult,
  isLoading,
  onAnalyzePredictive,
  onViewJson,
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'schedule' | 'history' | 'technical'>('upcoming');

  const history = vehicleMeta?.history || [];
  const needs = predictiveResult?.predicted_maintenance_needs || [];
  const schedules = predictiveResult?.recommended_schedule_adjustments || [];
  const recurringIssues = predictiveResult?.recurring_issues || [];
  const patterns = predictiveResult?.common_failure_patterns || [];

  // Total estimated repair / maintenance cost
  const totalEstCostInr = needs.reduce((acc, curr) => {
    const cost = curr.estimated_cost_inr ?? 15000;
    return acc + cost;
  }, 0);

  const nearestWindow = needs[0]?.predicted_failure_window || 'Next 1,000 km / 14 Days';
  const nearestComponent = needs[0]?.component || 'Scheduled Periodic Service';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between h-full space-y-4 sm:space-y-5 min-w-0">
      {/* Normal, Clean Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-3 sm:pb-4 min-w-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <CalendarClock className="w-4 sm:w-5 h-4 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 font-sans truncate">
                Maintenance Forecast
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-slate-800 text-amber-400 border border-slate-700 font-semibold shrink-0">
                Unit {snapshot.vehicle_id}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 font-sans truncate">
              Upcoming service, intervals and past logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onViewJson}
            className="px-2.5 sm:px-3 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Inspect raw JSON output"
          >
            <span className="text-amber-400 font-bold">{`{ }`}</span>
            <span>JSON</span>
          </button>

          <button
            id="run-pm-check-btn"
            onClick={onAnalyzePredictive}
            disabled={isLoading}
            className="px-3 sm:px-3.5 py-1.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-sans flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 active:scale-95 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Checking...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 3 Simple At-A-Glance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        {/* Next Service Due */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-3.5 flex items-start gap-3 min-w-0 overflow-hidden">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-mono uppercase text-slate-400">Next Service Due</div>
            <div className="text-xs sm:text-sm font-bold text-slate-100 mt-0.5">{nearestWindow}</div>
            <div className="text-[11px] text-amber-400/90 mt-0.5">{nearestComponent}</div>
          </div>
        </div>

        {/* Action Items Count */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-3.5 flex items-start gap-3 min-w-0 overflow-hidden">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
            <Wrench className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-mono uppercase text-slate-400">Items Due For Check</div>
            <div className="text-xs sm:text-sm font-bold text-slate-100 mt-0.5">
              {needs.length > 0 ? `${needs.length} Service Task${needs.length > 1 ? 's' : ''}` : 'All Clear'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {needs.length > 0 ? 'Inspection recommended' : 'No overdue service items'}
            </div>
          </div>
        </div>

        {/* Estimated Service Cost */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-3.5 flex items-start gap-3 min-w-0 overflow-hidden">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-mono uppercase text-slate-400">Estimated Service Cost</div>
            <div className="text-sm sm:text-base font-bold text-emerald-400 font-mono mt-0.5">
              ₹{(totalEstCostInr || 24000).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Estimated parts & labor</div>
          </div>
        </div>
      </div>

      {/* Clean Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-2 text-xs font-sans overflow-x-auto no-scrollbar scrollbar-none custom-scrollbar-none min-w-0">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
            activeTab === 'upcoming'
              ? 'bg-amber-400 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Upcoming Services ({needs.length})</span>
        </button>

        <button
          id="pm-tab-schedule-estimator-btn"
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
            activeTab === 'schedule'
              ? 'bg-amber-400 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          <span>Service Schedule & Cost Estimator</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
            activeTab === 'history'
              ? 'bg-amber-400 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Service History ({history.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('technical')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
            activeTab === 'technical'
              ? 'bg-amber-400 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Technical Diagnostics</span>
        </button>
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 min-w-0">
        {/* TAB 1: UPCOMING SERVICES */}
        {activeTab === 'upcoming' && (
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">Items that need technician inspection or servicing in the near term:</span>
              <span className="font-mono text-[11px] shrink-0 ml-2">{needs.length} actions recommended</span>
            </div>

            {needs.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-3xl border border-slate-800">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-200">All Scheduled Systems Normal</div>
                <p className="text-xs text-slate-400 mt-1">No urgent maintenance or component replacements detected.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 min-w-0">
                {needs.map((item, idx) => {
                  const costInr = item.estimated_cost_inr ?? 18000;

                  return (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between transition-all min-w-0 overflow-hidden"
                    >
                      <div className="min-w-0">
                        {/* Component Title & Due Window with Fixed Non-overflowing Match Badge */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-100 leading-snug break-words">
                                {item.component}
                              </h4>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0 whitespace-nowrap">
                                {item.confidence_pct}% Match
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-amber-400 font-semibold mt-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">Due: {item.predicted_failure_window}</span>
                            </span>
                          </div>
                        </div>

                        {/* Clear Recommended Action */}
                        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-2.5 my-2 text-xs text-slate-300 leading-relaxed font-sans min-w-0">
                          <span className="text-slate-400 font-semibold block text-[10px] sm:text-[11px] mb-0.5 uppercase font-mono">
                            Recommended Action:
                          </span>
                          <p className="break-words">{item.recommended_action}</p>
                        </div>
                      </div>

                      {/* Cost & Confidence Footer */}
                      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 text-[11px]">Est. Cost:</span>
                        <span className="font-bold text-slate-100 font-mono">
                          ₹{costInr.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SERVICE SCHEDULE & COST ESTIMATOR */}
        {activeTab === 'schedule' && (
          <div className="space-y-5 min-w-0">
            {/* Dynamic Service Schedule Intervals Table */}
            <div className="space-y-3 min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                  Commercial Service Schedule & Adjusted Intervals
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Operating Load: {snapshot.telemetry.engine_load_pct}% • {snapshot.engine_hours.toFixed(1)} hrs
                </span>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-800 shadow-sm">
                <table className="w-full text-xs font-sans text-left bg-slate-950">
                  <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Service Task</th>
                      <th className="p-3">Standard Interval</th>
                      <th className="p-3 text-amber-400">Recommended Interval</th>
                      <th className="p-3">Operating Condition Adjustment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {schedules.map((adj, i) => (
                      <tr key={i} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 font-semibold text-slate-200 font-sans">{adj.task}</td>
                        <td className="p-3 text-slate-400 line-through opacity-70">{adj.current_interval}</td>
                        <td className="p-3 text-amber-400 font-bold">{adj.recommended_interval}</td>
                        <td className="p-3 text-slate-300 font-sans text-xs">{adj.reasoning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Interactive Service Cost Estimator */}
            <ServiceCostEstimator snapshot={snapshot} vehicleMeta={vehicleMeta} />
          </div>
        )}

        {/* TAB 3: SERVICE & FAULT HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3 min-w-0">
            <div className="text-xs text-slate-400">
              Chronological inspection and maintenance log recorded for Unit {snapshot.vehicle_id}:
            </div>

            {history.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-3xl border border-slate-800 text-xs text-slate-400">
                No previous service records recorded for this unit yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((record, i) => (
                  <div
                    key={i}
                    className="bg-slate-950 border border-slate-800 rounded-3xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 overflow-hidden"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 font-mono text-xs shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-slate-200">{record.date}</span>
                          <span className="text-[11px] font-mono text-slate-400">• {record.engine_hours} hrs</span>
                          {record.dtc_logged.length === 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xl bg-emerald-500/10 text-emerald-400 font-semibold">
                              Clean Run
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 font-sans break-words">{record.notes}</p>
                      </div>
                    </div>

                    {/* Logged DTCs */}
                    {record.dtc_logged.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <span className="text-[11px] text-slate-500 font-mono">Faults:</span>
                        {record.dtc_logged.map((code, ci) => (
                          <span
                            key={ci}
                            className="px-2 py-0.5 rounded-xl bg-rose-500/15 text-rose-300 font-mono text-xs border border-rose-500/30 font-bold"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TECHNICAL DIAGNOSTICS & CORRELATIONS */}
        {activeTab === 'technical' && (
          <div className="space-y-4 min-w-0">
            {/* Recurring Issues */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Recurring Fault Trends
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                {recurringIssues.map((issue, idx) => (
                  <div key={idx} className="p-3 rounded-3xl bg-slate-950 border border-slate-800 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
                      <span className="text-xs font-bold text-slate-200 truncate">{issue.issue_name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                        {issue.frequency_last_90d}x logged
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans break-words">
                      {issue.root_cause_trend}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Patterns & Correlations */}
            {patterns.length > 0 && (
              <div className="p-3.5 rounded-3xl bg-slate-950 border border-slate-800 min-w-0">
                <h4 className="text-xs font-bold text-slate-300 font-mono mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  Cross-System Findings
                </h4>
                <div className="space-y-1.5">
                  {patterns.map((p, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-blue-400 font-bold">•</span>
                      <span className="break-words">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
