import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Search, Wrench, ShieldAlert, Cpu, Fuel, Flame, Gauge, 
  CheckCircle2, Plus, Zap, ArrowRight, BookOpen, AlertOctagon, HelpCircle
} from 'lucide-react';
import { TATA_MOTORS_BSVI_DTC_LIST, TataDtcItem } from '../data/tataMotorsDtcData';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface TataMotorsDtcModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCodes: string[];
  onAddCode: (code: string) => void;
}

export const TataMotorsDtcModal: React.FC<TataMotorsDtcModalProps> = ({
  isOpen,
  onClose,
  activeCodes,
  onAddCode,
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDtc, setSelectedDtc] = useState<TataDtcItem>(TATA_MOTORS_BSVI_DTC_LIST[0]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    TATA_MOTORS_BSVI_DTC_LIST.forEach((d) => set.add(d.category));
    return ['All', ...Array.from(set)];
  }, []);

  const filteredDtcs = useMemo(() => {
    return TATA_MOTORS_BSVI_DTC_LIST.filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.code.toLowerCase().includes(q) ||
        item.baseCode.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.subsystem.toLowerCase().includes(q) ||
        item.effectOnVehicle.toLowerCase().includes(q) ||
        (item.schematicNote && item.schematicNote.toLowerCase().includes(q)) ||
        item.causes.some((c) => c.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const isActive = activeCodes.includes(selectedDtc.code) || activeCodes.includes(selectedDtc.baseCode);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 font-display">
                  Tata Motors BSVI Diagnostic Trouble Code Manual
                </h2>
                <span className="px-2 py-0.5 rounded-xl text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  3.3L NGE & Bosch MD1CS018
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official workshop troubleshooting procedures, pinout schematics, and sensor diagnostic specs ({TATA_MOTORS_BSVI_DTC_LIST.length} BSVI Fault Codes cataloged)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Close Manual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search DTC (e.g. P0192, P244B, EGR, Urea)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-9 pr-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-colors border ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Body Split View */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-[460px]">
          
          {/* Left Column: DTC List */}
          <div className="lg:col-span-5 border-r border-slate-800 overflow-y-auto max-h-[60vh] lg:max-h-none p-3 space-y-2 bg-slate-950/40">
            <div className="text-[11px] font-mono text-slate-400 px-2 py-1 flex items-center justify-between">
              <span>Showing {filteredDtcs.length} of {TATA_MOTORS_BSVI_DTC_LIST.length} DTCs</span>
              {selectedCategory !== 'All' && <span className="text-amber-400">{selectedCategory}</span>}
            </div>

            {filteredDtcs.map((item) => {
              const isSelected = selectedDtc.code === item.code;
              const isCurrentlyActive = activeCodes.includes(item.code) || activeCodes.includes(item.baseCode);

              return (
                <div
                  key={item.code}
                  onClick={() => setSelectedDtc(item)}
                  className={`p-3 rounded-3xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                      : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {item.code}
                      </span>
                      {isCurrentlyActive && (
                        <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          ACTIVE IN TRUCK
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400">
                      {item.category}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">
                    {item.title}
                  </h4>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate max-w-[200px]">{item.subsystem}</span>
                    <span className="text-rose-400/90 font-mono text-[10px]">{item.effectOnVehicle}</span>
                  </div>
                </div>
              );
            })}

            {filteredDtcs.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm">No DTC found matching "{searchQuery}"</p>
                <p className="text-xs text-slate-400 mt-1">Try searching by code (e.g. P0192) or component (e.g. Rail, EGR, DPF)</p>
              </div>
            )}
          </div>

          {/* Right Column: Detailed Workshop Steps & Schematic */}
          <div className="lg:col-span-7 overflow-y-auto max-h-[60vh] lg:max-h-none p-5 bg-slate-900/60 flex flex-col justify-between">
            <div className="space-y-4">
              
              {/* Top Banner for selected DTC */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xl font-bold text-amber-400">
                        {selectedDtc.code}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        (Base: {selectedDtc.baseCode})
                      </span>
                      <span className="px-2 py-0.5 rounded-xl text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300">
                        {selectedDtc.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 mt-1 break-words">
                      {selectedDtc.title}
                    </h3>
                  </div>

                  {/* Inject / Remove Button */}
                  <button
                    onClick={() => onAddCode(selectedDtc.code)}
                    disabled={isActive}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-bold font-mono flex items-center gap-1.5 transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Loaded in Telemetry</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Active Telemetry</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Subsystem & Impact Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
                  <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">Subsystem</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">{selectedDtc.subsystem}</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">Vehicle Effect</span>
                    <span className="font-semibold text-rose-300 mt-0.5 block">{selectedDtc.effectOnVehicle}</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">Cluster Lamps</span>
                    <span className="font-mono text-amber-300/90 mt-0.5 block text-[11px]">{selectedDtc.milStatus}</span>
                  </div>
                </div>

                {/* Schematic / ECU pin wiring note */}
                {selectedDtc.schematicNote && (
                  <div className="mt-3 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-start gap-2 text-xs">
                    <Cpu className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-blue-300 font-mono">ECU MD1CS018 Pinout Note: </span>
                      <span className="text-slate-300 font-mono text-[11px]">{selectedDtc.schematicNote}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Causes & Pre-Checks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-3.5">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-2">
                    <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                    Root Causes:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedDtc.causes.map((cause, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 font-mono">•</span>
                        <span>{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-3.5">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Pre-Checkpoints:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedDtc.checkpoints.map((cp, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-mono">✓</span>
                        <span>{cp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Workshop Step-by-Step Troubleshooting Procedure */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  Workshop Diagnostic Action Sequence (Bosch MD1CS018 Standard)
                </h4>

                <div className="space-y-2.5">
                  {selectedDtc.steps.map((stepItem) => (
                    <div
                      key={stepItem.step}
                      className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-start gap-3"
                    >
                      <span className="w-6 h-6 rounded-xl-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                        {stepItem.step}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs text-slate-200 leading-relaxed font-medium">
                          {stepItem.action}
                        </p>
                        {stepItem.spec && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-300">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>Specification: <strong>{stepItem.spec}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Standard: Tata Motors BSVI Commercial Vehicle Service Manual</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
              >
                Done
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
