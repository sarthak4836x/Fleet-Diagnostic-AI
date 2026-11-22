import React, { useState } from 'react';
import { 
  AlertTriangle, Plus, X, Info, Tag, Check, ShieldAlert, 
  BookOpen, Search, Wrench, Zap, CheckCircle2, ChevronRight, Cpu
} from 'lucide-react';
import { DTC_DATABASE } from '../data/fleetData';
import { TATA_MOTORS_BSVI_DTC_LIST } from '../data/tataMotorsDtcData';
import { TataMotorsDtcModal } from './TataMotorsDtcModal';

interface DtcCodeManagerProps {
  activeCodes: string[];
  onChangeCodes: (codes: string[]) => void;
}

export const DtcCodeManager: React.FC<DtcCodeManagerProps> = ({
  activeCodes,
  onChangeCodes,
}) => {
  const [selectedCode, setSelectedCode] = useState<string | null>(
    activeCodes.length > 0 ? activeCodes[0] : null
  );
  const [customInput, setCustomInput] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'All' | 'Tata BSVI' | 'Standard HD'>('Tata BSVI');
  const [showTataModal, setShowTataModal] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const handleAddCode = (codeToAdd: string) => {
    const formatted = codeToAdd.trim().toUpperCase();
    if (!formatted) return;
    if (!activeCodes.includes(formatted)) {
      const updated = [...activeCodes, formatted];
      onChangeCodes(updated);
      setSelectedCode(formatted);
    }
    setCustomInput('');
    setShowAddMenu(false);
    setClearMessage(null);
  };

  const handleRemoveCode = (codeToRemove: string) => {
    const updated = activeCodes.filter((c) => c !== codeToRemove);
    onChangeCodes(updated);
    if (selectedCode === codeToRemove) {
      setSelectedCode(updated.length > 0 ? updated[0] : null);
    }
    if (updated.length === 0) {
      setClearMessage('All DTC codes cleared from vehicle memory');
      setTimeout(() => setClearMessage(null), 3500);
    }
  };

  const handleClearAllCodes = () => {
    onChangeCodes([]);
    setSelectedCode(null);
    setClearMessage('All DTC codes cleared successfully from vehicle ECU');
    setTimeout(() => setClearMessage(null), 4000);
  };

  const selectedDef = selectedCode ? DTC_DATABASE[selectedCode] : null;

  // Filter available DTC keys for quick add
  const filteredQuickCodes = Object.keys(DTC_DATABASE).filter((code) => {
    const def = DTC_DATABASE[code];
    const isTata = def?.title.startsWith('[Tata BSVI]') || code.includes('-');
    if (quickFilter === 'Tata BSVI') return isTata;
    if (quickFilter === 'Standard HD') return !isTata;
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase font-display">
            Active Diagnostic Trouble Codes (DTCs)
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            {activeCodes.length} ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tata Motors Manual Button */}
          <button
            onClick={() => setShowTataModal(true)}
            className="text-xs px-3 py-1.5 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5 transition-colors font-medium"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Tata BSVI DTC Catalog ({TATA_MOTORS_BSVI_DTC_LIST.length})</span>
          </button>

          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="text-xs px-2.5 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Fault Code</span>
          </button>
          {activeCodes.length > 0 && (
            <button
              id="dtc-clear-all-btn"
              type="button"
              onClick={handleClearAllCodes}
              title="Clear all active DTC trouble codes from ECU memory"
              className="text-xs px-2.5 py-1.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 font-mono transition-all ml-1 flex items-center gap-1 active:scale-95 cursor-pointer font-bold"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear All Codes</span>
            </button>
          )}
        </div>
      </div>

      {/* Clear Success Feedback Banner */}
      {clearMessage && (
        <div className="mb-3.5 p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{clearMessage}</span>
          </div>
          <button
            onClick={() => setClearMessage(null)}
            className="text-emerald-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Add Menu */}
      {showAddMenu && (
        <div className="mb-4 p-4 bg-slate-950 rounded-3xl border border-slate-800 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter DTC code (e.g., P0192-00, P244B-00, P0118, P2202)..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCode(customInput)}
              className="bg-slate-900 border border-slate-700 rounded-2xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400 flex-1"
            />
            <button
              onClick={() => handleAddCode(customInput)}
              className="px-4 py-1.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold font-mono shadow-sm"
            >
              Add
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">Filter Catalog:</span>
              {(['Tata BSVI', 'Standard HD', 'All'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setQuickFilter(filter)}
                  className={`text-[10px] px-2 py-0.5 rounded-xl font-medium border transition-colors ${
                    quickFilter === filter
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowAddMenu(false);
                setShowTataModal(true);
              }}
              className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-mono"
            >
              Browse Full Tata BSVI Workshop Manual →
            </button>
          </div>

          <div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-900/50 rounded-2xl border border-slate-800/80">
              {filteredQuickCodes.slice(0, 30).map((code) => {
                const isPresent = activeCodes.includes(code);
                const def = DTC_DATABASE[code];
                const cleanTitle = def?.title.replace('[Tata BSVI] ', '') || '';
                return (
                  <button
                    key={code}
                    disabled={isPresent}
                    onClick={() => handleAddCode(code)}
                    className={`px-2 py-1 rounded-xl text-xs font-mono transition-colors border text-left ${
                      isPresent
                        ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-amber-500/50'
                    }`}
                  >
                    <span className="font-bold text-amber-400">{code}</span>
                    <span className="text-slate-400 text-[10px] ml-1.5">
                      {cleanTitle.slice(0, 22)}...
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Codes Chips and Selected Code Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left column: List of active chips */}
        <div className="lg:col-span-5 space-y-2">
          {activeCodes.length === 0 ? (
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center text-xs text-emerald-400">
              <Check className="w-5 h-5 mx-auto mb-1.5" />
              <p className="font-semibold">No active DTC codes detected</p>
              <p className="text-[11px] text-slate-400 mt-1">System reporting MIL inactive & normal torque limit.</p>
            </div>
          ) : (
            activeCodes.map((code) => {
              const info = DTC_DATABASE[code];
              const isSelected = selectedCode === code;
              const isTata = info?.title.startsWith('[Tata BSVI]') || code.includes('-');

              return (
                <div
                  key={code}
                  onClick={() => setSelectedCode(code)}
                  className={`p-3 rounded-3xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm'
                      : 'bg-slate-950/70 hover:bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="flex flex-col min-w-0 w-full">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-amber-400">{code}</span>
                        {isTata && (
                          <span className="px-1 py-0.2 rounded-xl text-[9px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            TATA BSVI
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-200 max-w-full">
                        {info ? info.title.replace('[Tata BSVI] ', '') : 'Commercial DTC Code'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {info && (
                      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-xl border ${
                        info.severity === 'Critical'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : info.severity === 'High'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {info.severity}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCode(code);
                      }}
                      className="p-1 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Remove DTC code"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right column: Detailed breakdown of selected code */}
        <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-3xl p-4 min-h-[220px] flex flex-col justify-between">
          {selectedDef ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold font-mono text-amber-400">{selectedDef.code}</span>
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-xl border ${
                      selectedDef.severity === 'Critical'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : selectedDef.severity === 'High'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      Severity: {selectedDef.severity}
                    </span>
                    {selectedDef.effectOnVehicle && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30">
                        {selectedDef.effectOnVehicle}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-200 mt-1 break-words">{selectedDef.title}</p>
                </div>
                {selectedDef.milStatus && (
                  <span className="text-[10px] font-mono text-amber-300/90 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                    {selectedDef.milStatus}
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-300 leading-relaxed">
                <span className="text-slate-400 font-medium">Subsystem: </span>
                {selectedDef.component}
              </div>

              {selectedDef.schematicNote && (
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-start gap-2 text-xs">
                  <Cpu className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-blue-300 font-mono">ECU MD1CS018 Pinout: </span>
                    <span className="text-slate-300 font-mono text-[11px]">{selectedDef.schematicNote}</span>
                  </div>
                </div>
              )}

              {/* Checkpoints & Step by step diagnostic specs */}
              {selectedDef.checkpoints && selectedDef.checkpoints.length > 0 && (
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase font-mono block mb-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Workshop Pre-Checkpoints:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[11px] text-slate-300">
                    {selectedDef.checkpoints.map((cp, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{cp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDef.steps && selectedDef.steps.length > 0 && (
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase font-mono flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5" />
                      Multimeter & Wiring Steps:
                    </span>
                    <button
                      onClick={() => setShowTataModal(true)}
                      className="text-[10px] text-blue-400 hover:underline font-mono flex items-center gap-0.5"
                    >
                      View All Steps & Specs →
                    </button>
                  </div>
                  <div className="space-y-1 text-xs">
                    {selectedDef.steps.slice(0, 3).map((st) => (
                      <div key={st.step} className="flex items-start gap-2 text-slate-300">
                        <span className="text-[10px] font-mono text-amber-400 font-bold">#{st.step}</span>
                        <span className="text-[11px] leading-tight">{st.action}</span>
                        {st.spec && (
                          <span className="text-[10px] font-mono text-amber-300 bg-slate-950 px-1.5 py-0.2 rounded-xl border border-slate-800 shrink-0">
                            {st.spec}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDef.common_symptoms && selectedDef.common_symptoms.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase font-mono block mb-1">
                    Causes & Workshop Symptoms:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDef.common_symptoms.map((symptom, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : selectedCode ? (
            <div className="space-y-2 text-xs">
              <span className="font-mono font-bold text-amber-400">{selectedCode}</span>
              <p className="text-slate-400">
                Custom commercial DTC registered in active telemetry stream. AI engine will evaluate this code against vehicle telemetry and powertrain architecture.
              </p>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
              Select or add a DTC code to inspect SPN/FMI protocol translation and workshop symptoms.
            </div>
          )}
        </div>
      </div>

      {/* Tata Motors DTC Troubleshooting Manual Modal */}
      <TataMotorsDtcModal
        isOpen={showTataModal}
        onClose={() => setShowTataModal(false)}
        activeCodes={activeCodes}
        onAddCode={(code) => {
          handleAddCode(code);
        }}
      />
    </div>
  );
};
