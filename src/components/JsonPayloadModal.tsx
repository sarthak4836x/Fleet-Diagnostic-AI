import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Code, FileText, CheckCircle2, ArrowRight, Fuel, CalendarClock, Activity } from 'lucide-react';
import { VehicleSnapshot, DiagnosticResult, FuelEfficiencyResult, PredictiveMaintenanceResult } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface JsonPayloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSnapshot: VehicleSnapshot;
  currentResult: DiagnosticResult | null;
  fuelResult?: FuelEfficiencyResult | null;
  predictiveResult?: PredictiveMaintenanceResult | null;
  initialTab?: 'input' | 'diagnostics' | 'fuel' | 'predictive' | 'schemas';
  onLoadCustomJson: (customSnapshot: VehicleSnapshot) => void;
}

export const JsonPayloadModal: React.FC<JsonPayloadModalProps> = ({
  isOpen,
  onClose,
  currentSnapshot,
  currentResult,
  fuelResult,
  predictiveResult,
  initialTab = 'input',
  onLoadCustomJson,
}) => {
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const [activeTab, setActiveTab] = useState<'input' | 'diagnostics' | 'fuel' | 'predictive' | 'schemas'>(initialTab);
  const [copied, setCopied] = useState(false);
  const [rawInputText, setRawInputText] = useState(JSON.stringify(currentSnapshot, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCustomJson = () => {
    try {
      setParseError(null);
      const parsed = JSON.parse(rawInputText);
      if (!parsed.vehicle_id || !parsed.telemetry) {
        throw new Error("JSON must include 'vehicle_id' and 'telemetry' object.");
      }
      onLoadCustomJson(parsed);
      onClose();
    } catch (err: any) {
      setParseError(err?.message || 'Invalid JSON syntax');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-slate-100"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <Code className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold font-display tracking-wide">
                Structured JSON Outputs & Diagnostic Schemas
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Vehicle: {currentSnapshot.vehicle_id} • Heavy-Duty Commercial Vehicle AI Specs
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 sm:px-6 text-xs font-mono overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('input')}
            className={`py-3 px-3.5 border-b-2 font-medium shrink-0 transition-colors ${
              activeTab === 'input'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. User Input Snapshot
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`py-3 px-3.5 border-b-2 font-medium shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>2. Diagnostics JSON</span>
          </button>

          <button
            onClick={() => setActiveTab('fuel')}
            className={`py-3 px-3.5 border-b-2 font-medium shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === 'fuel'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Fuel className="w-3.5 h-3.5" />
            <span>3. Fuel Efficiency JSON</span>
          </button>

          <button
            onClick={() => setActiveTab('predictive')}
            className={`py-3 px-3.5 border-b-2 font-medium shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === 'predictive'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>4. Predictive Maintenance JSON</span>
          </button>

          <button
            onClick={() => setActiveTab('schemas')}
            className={`py-3 px-3.5 border-b-2 font-medium shrink-0 transition-colors ${
              activeTab === 'schemas'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            5. System Schemas
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 overflow-y-auto font-mono text-xs">
          {/* TAB 1: User Input Payload */}
          {activeTab === 'input' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-slate-400">
                <span>Vehicle Telemetry Payload ({currentSnapshot.vehicle_id}):</span>
                <button
                  onClick={() => copyToClipboard(rawInputText)}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              <textarea
                value={rawInputText}
                onChange={(e) => setRawInputText(e.target.value)}
                rows={12}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400/80 leading-relaxed"
              />

              {parseError && (
                <p className="text-rose-400 text-xs font-mono">{parseError}</p>
              )}

              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500 text-[11px]">
                  Edit the JSON above and click Apply to inject custom telemetry snapshot.
                </span>
                <button
                  onClick={handleApplyCustomJson}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center gap-1.5 transition-colors"
                >
                  <span>Apply to Telemetry Cluster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Diagnostics Output JSON */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span>General Diagnostics Output (Health Score, Status, DTC Action Plan):</span>
                {currentResult && (
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(currentResult, null, 2))}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Output'}</span>
                  </button>
                )}
              </div>
              {currentResult ? (
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-amber-300 font-mono text-xs overflow-x-auto leading-relaxed">
                  {JSON.stringify(currentResult, null, 2)}
                </pre>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  No diagnostic response generated yet. Run &quot;Analyze Telemetry&quot; first.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Fuel Efficiency JSON */}
          {activeTab === 'fuel' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span>Fuel Efficiency Output (MPG, Deviations, Causes, Recommendations):</span>
                {fuelResult && (
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(fuelResult, null, 2))}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Fuel JSON'}</span>
                  </button>
                )}
              </div>
              {fuelResult ? (
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed">
                  {JSON.stringify(fuelResult, null, 2)}
                </pre>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  No fuel efficiency analysis generated yet. Click &quot;Analyze Fuel Efficiency&quot; in the Fuel tab.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Predictive Maintenance JSON */}
          {activeTab === 'predictive' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span>Predictive Maintenance Output (Recurring Issues, Failure Patterns, PM Adjustments):</span>
                {predictiveResult && (
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(predictiveResult, null, 2))}
                    className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Predictive JSON'}</span>
                  </button>
                )}
              </div>
              {predictiveResult ? (
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-purple-300 font-mono text-xs overflow-x-auto leading-relaxed">
                  {JSON.stringify(predictiveResult, null, 2)}
                </pre>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  No predictive maintenance analysis generated yet. Click &quot;Run Predictive Maintenance AI&quot; in the Predictive tab.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: System Schemas */}
          {activeTab === 'schemas' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-slate-300 font-bold mb-1">Fuel Efficiency Response Schema:</h4>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-emerald-400 font-mono text-[11px] overflow-x-auto">
{`{
  "vehicle_id": "FLEET-042",
  "current_mpg": 5.18,
  "baseline_expected_mpg": 7.2,
  "efficiency_rating": "POOR",
  "fuel_rate_gph": 11.2,
  "idle_fuel_percentage": 26,
  "potential_causes": [
    { "factor": "string", "impact_mpg": -0.8, "description": "string", "severity": "SEVERE" }
  ],
  "actionable_recommendations": ["string"],
  "estimated_monthly_savings_usd": 2194
}`}
                </pre>
              </div>

              <div>
                <h4 className="text-slate-300 font-bold mb-1">Predictive Maintenance Response Schema:</h4>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-purple-400 font-mono text-[11px] overflow-x-auto">
{`{
  "vehicle_id": "FLEET-042",
  "recurring_issues": [
    { "issue_name": "string", "frequency_last_90d": 3, "root_cause_trend": "string", "severity": "High" }
  ],
  "common_failure_patterns": ["string"],
  "predicted_maintenance_needs": [
    { "component": "string", "predicted_failure_window": "string", "confidence_pct": 92, "recommended_action": "string" }
  ],
  "recommended_schedule_adjustments": [
    { "task": "string", "current_interval": "string", "recommended_interval": "string", "reasoning": "string" }
  ]
}`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
