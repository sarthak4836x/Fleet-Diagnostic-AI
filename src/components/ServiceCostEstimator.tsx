import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Wrench,
  CheckSquare,
  Square,
  IndianRupee,
  Clock,
  Printer,
  Sparkles,
  Percent,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  RotateCcw,
  FileCheck,
  Plus,
  X,
} from 'lucide-react';
import { ServiceTaskItem, VehicleSnapshot, FleetVehicle } from '../types';

export const DEFAULT_SERVICE_TASKS: ServiceTaskItem[] = [
  {
    id: 'task-oil-filters',
    task: 'Engine Oil & Dual Filter Replacement (38L 15W-40 CK-4)',
    category: 'Engine & Lube',
    standardIntervalKm: 40000,
    estimatedLaborHours: 1.5,
    partsCostInr: 12500,
    recommendedDue: true,
    priority: 'Urgent',
    description: 'Full synthetic heavy-duty lube flush, spin-on full-flow and bypass filter canisters.',
  },
  {
    id: 'task-air-filter',
    task: 'Heavy-Duty Primary & Secondary Air Filter Elements',
    category: 'Engine & Lube',
    standardIntervalKm: 20000,
    estimatedLaborHours: 0.5,
    partsCostInr: 5800,
    recommendedDue: true,
    priority: 'Recommended',
    description: 'Replacement of inner safety and outer primary engine intake air filters to ensure optimal combustion airflow.',
  },
  {
    id: 'task-cabin-filter',
    task: 'HVAC Cabin Air Filter & A/C System Sanitization',
    category: 'Cooling & Electrical',
    standardIntervalKm: 15000,
    estimatedLaborHours: 0.6,
    partsCostInr: 1200,
    recommendedDue: false,
    priority: 'Routine',
    description: 'HEPA rated cabin filter cartridge replacement with evaporator core antimicrobial deodorizing treatment.',
  },
  {
    id: 'task-air-dryer-filter',
    task: 'Pneumatic Air Dryer Desiccant Cartridge & Purge Valve',
    category: 'Braking & Chassis',
    standardIntervalKm: 50000,
    estimatedLaborHours: 1.0,
    partsCostInr: 3500,
    recommendedDue: true,
    priority: 'Recommended',
    description: 'Desiccant filter element renewal to prevent moisture and oil blow-by entering the air brake reservoir tanks.',
  },
  {
    id: 'task-power-steering-filter',
    task: 'Power Steering Hydraulic Fluid & Inline Filter',
    category: 'Braking & Chassis',
    standardIntervalKm: 80000,
    estimatedLaborHours: 1.2,
    partsCostInr: 2800,
    recommendedDue: false,
    priority: 'Routine',
    description: 'Hydraulic system flush, reservoir cleanout, and replacement of internal steering fluid filter element.',
  },
  {
    id: 'task-dpf-clean',
    task: 'DPF Core Cleaning, Thermal Bake & De-Ashing',
    category: 'Aftertreatment & DPF',
    standardIntervalKm: 80000,
    estimatedLaborHours: 3.0,
    partsCostInr: 18500,
    recommendedDue: true,
    priority: 'Recommended',
    description: 'Pneumatic pulse ash blowout and 600°C kiln bake to restore substrate flow backpressure.',
  },
  {
    id: 'task-def-doser',
    task: 'DEF / AdBlue Dosing Valve De-crystallization & Pump Filter',
    category: 'Aftertreatment & DPF',
    standardIntervalKm: 50000,
    estimatedLaborHours: 1.2,
    partsCostInr: 4800,
    recommendedDue: false,
    priority: 'Routine',
    description: 'Ultrasonic cleaning of nozzle injector tip, screen replacement, and spray cone angle validation.',
  },
  {
    id: 'task-fuel-filters',
    task: 'Primary Fuel Pre-Filter & Water Separator Cartridge',
    category: 'Fuel System',
    standardIntervalKm: 30000,
    estimatedLaborHours: 0.8,
    partsCostInr: 3200,
    recommendedDue: true,
    priority: 'Recommended',
    description: '10-micron coalescing element renewal with water-in-fuel (WIF) sensor probe cleaning.',
  },
  {
    id: 'task-brakes-liners',
    task: 'S-Cam Air Brake Relining & Slack Adjuster Calibration',
    category: 'Braking & Chassis',
    standardIntervalKm: 60000,
    estimatedLaborHours: 2.5,
    partsCostInr: 9600,
    recommendedDue: false,
    priority: 'Routine',
    description: 'Liners inspection, return springs renewal, automatic slack clearance gauge setting.',
  },
  {
    id: 'task-coolant-flush',
    task: 'Extended Life Heavy-Duty Coolant Drain & Flush (45L OAT)',
    category: 'Cooling & Electrical',
    standardIntervalKm: 100000,
    estimatedLaborHours: 2.0,
    partsCostInr: 7800,
    recommendedDue: false,
    priority: 'Routine',
    description: 'Organic acid technology (OAT) coolant refill, thermostat seal inspection, freeze protection check.',
  },
  {
    id: 'task-valve-lash',
    task: 'Overhead Valve Lash & Unit Injector Height Adjustment',
    category: 'Engine & Lube',
    standardIntervalKm: 120000,
    estimatedLaborHours: 3.5,
    partsCostInr: 2200,
    recommendedDue: false,
    priority: 'Routine',
    description: 'Feeler gauge mechanical valve clearances calibration to optimize compression and fuel atomization.',
  },
  {
    id: 'task-transmission-fluid',
    task: 'Heavy-Duty Transmission & Differential Synthetic Gear Oil',
    category: 'Engine & Lube',
    standardIntervalKm: 90000,
    estimatedLaborHours: 1.8,
    partsCostInr: 11400,
    recommendedDue: false,
    priority: 'Routine',
    description: '75W-90 synthetic gear oil drain with magnetic drain plug metal flake inspection.',
  },
  {
    id: 'task-wheel-bearings',
    task: 'Front Axle Wheel Hub Bearing Greasing & Stemco Seals',
    category: 'Braking & Chassis',
    standardIntervalKm: 75000,
    estimatedLaborHours: 2.2,
    partsCostInr: 5400,
    recommendedDue: false,
    priority: 'Routine',
    description: 'Wheel end repack with high-temp lithium complex grease and new oil bath seals.',
  },
];

interface ServiceCostEstimatorProps {
  snapshot: VehicleSnapshot;
  vehicleMeta?: FleetVehicle;
  onApplyToWorkOrder?: (tasks: ServiceTaskItem[], totalCost: number) => void;
}

export const ServiceCostEstimator: React.FC<ServiceCostEstimatorProps> = ({
  snapshot,
  vehicleMeta,
  onApplyToWorkOrder,
}) => {
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([
    'task-oil-filters',
    'task-dpf-clean',
    'task-fuel-filters',
  ]);
  const [customTasks, setCustomTasks] = useState<ServiceTaskItem[]>([]);
  const [showCustomTaskForm, setShowCustomTaskForm] = useState(false);
  const [customTaskInput, setCustomTaskInput] = useState<Partial<ServiceTaskItem>>({
    task: '',
    category: 'Custom Part',
    estimatedLaborHours: 1,
    partsCostInr: 0,
    description: '',
  });

  const [laborRatePerHour, setLaborRatePerHour] = useState<number>(650);
  const [discountPercent, setDiscountPercent] = useState<number>(5);
  const [includeGst, setIncludeGst] = useState<boolean>(true);
  const [shopSuppliesRate, setShopSuppliesRate] = useState<number>(4); // 4%
  const [appliedSuccess, setAppliedSuccess] = useState<boolean>(false);

  const allTasks = useMemo(() => {
    return [...DEFAULT_SERVICE_TASKS, ...customTasks];
  }, [customTasks]);

  const toggleTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedTaskIds(allTasks.map((t) => t.id));
  };

  const selectDueOnly = () => {
    setSelectedTaskIds(allTasks.filter((t) => t.recommendedDue).map((t) => t.id));
  };

  const clearAll = () => {
    setSelectedTaskIds([]);
  };

  const handleAddCustomTask = () => {
    if (!customTaskInput.task) return;
    const newTask: ServiceTaskItem = {
      id: `task-custom-${Date.now()}`,
      task: customTaskInput.task || 'Custom Task',
      category: customTaskInput.category || 'Custom Part',
      standardIntervalKm: 0,
      estimatedLaborHours: customTaskInput.estimatedLaborHours || 0,
      partsCostInr: customTaskInput.partsCostInr || 0,
      recommendedDue: true,
      priority: 'Routine',
      description: customTaskInput.description || '',
    };
    setCustomTasks((prev) => [...prev, newTask]);
    setSelectedTaskIds((prev) => [...prev, newTask.id]);
    setShowCustomTaskForm(false);
    setCustomTaskInput({
      task: '',
      category: 'Custom Part',
      estimatedLaborHours: 1,
      partsCostInr: 0,
      description: '',
    });
  };

  // Calculations
  const selectedTasks = useMemo(() => {
    return allTasks.filter((t) => selectedTaskIds.includes(t.id));
  }, [allTasks, selectedTaskIds]);

  const totalLaborHours = useMemo(() => {
    return selectedTasks.reduce((acc, t) => acc + t.estimatedLaborHours, 0);
  }, [selectedTasks]);

  const grossPartsCost = useMemo(() => {
    return selectedTasks.reduce((acc, t) => acc + t.partsCostInr, 0);
  }, [selectedTasks]);

  const grossLaborCost = totalLaborHours * laborRatePerHour;
  const subtotalBeforeDiscount = grossPartsCost + grossLaborCost;
  const discountAmount = (subtotalBeforeDiscount * discountPercent) / 100;
  const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;
  const shopSuppliesCost = (subtotalAfterDiscount * shopSuppliesRate) / 100;
  const taxableAmount = subtotalAfterDiscount + shopSuppliesCost;
  const gstAmount = includeGst ? (taxableAmount * 18) / 100 : 0;
  const grandTotalEstimate = taxableAmount + gstAmount;

  const handleApply = () => {
    if (onApplyToWorkOrder) {
      onApplyToWorkOrder(selectedTasks, grandTotalEstimate);
      setAppliedSuccess(true);
      setTimeout(() => setAppliedSuccess(false), 3000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3.5 sm:p-5 space-y-4 sm:space-y-5 shadow-lg">
      {/* Header & Mode Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-3 sm:pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100 font-sans">
              Service Cost Estimator & Quote Generator
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-slate-800 text-amber-400 border border-slate-700 font-semibold shrink-0">
              Unit {snapshot.vehicle_id}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
            Calculate accurate parts, workshop labor, consumables, and GST for scheduled commercial vehicle service.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={selectDueOnly}
            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-2xl text-[11px] sm:text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
          >
            Select Due Only
          </button>
          <button
            onClick={selectAll}
            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-2xl text-[11px] sm:text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={clearAll}
            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-2xl text-[11px] sm:text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 border border-slate-800 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Main Grid: Task Selection (Left 60%) + Quote Summary Card (Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Scheduled Service Task Picker */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-1">
            <span>AVAILABLE SCHEDULED MAINTENANCE TASKS ({allTasks.length})</span>
            <span>{selectedTaskIds.length} SELECTED</span>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {allTasks.map((task) => {
              const isSelected = selectedTaskIds.includes(task.id);
              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`p-3 rounded-3xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-950 border-amber-500/50 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      className="mt-0.5 text-amber-400 shrink-0 focus:outline-none"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 fill-amber-400/20 text-amber-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>
                          {task.task}
                        </span>
                        {task.recommendedDue && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Due Now
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
                          {task.category}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {task.description}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          Interval: {task.standardIntervalKm.toLocaleString()} km
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          Labor: {task.estimatedLaborHours} hrs
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Task Cost Column */}
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold font-mono text-slate-100">
                      ₹{task.partsCostInr.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Parts</span>
                  </div>
                </div>
              );
            })}

            {/* Custom Task Form */}
            {showCustomTaskForm ? (
              <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-3xl space-y-3 mt-2 shadow-lg animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom Part / Service
                  </h4>
                  <button onClick={() => setShowCustomTaskForm(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono uppercase">Task Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Replace Windshield Wiper"
                      value={customTaskInput.task}
                      onChange={(e) => setCustomTaskInput({ ...customTaskInput, task: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono uppercase">Category</label>
                    <input
                      type="text"
                      placeholder="e.g., Body & Glass"
                      value={customTaskInput.category}
                      onChange={(e) => setCustomTaskInput({ ...customTaskInput, category: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono uppercase">Est. Labor (Hours)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={customTaskInput.estimatedLaborHours}
                      onChange={(e) => setCustomTaskInput({ ...customTaskInput, estimatedLaborHours: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono uppercase">Parts Cost (INR)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={customTaskInput.partsCostInr}
                      onChange={(e) => setCustomTaskInput({ ...customTaskInput, partsCostInr: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 font-mono uppercase">Description (Optional)</label>
                    <input
                      type="text"
                      placeholder="Optional notes or details"
                      value={customTaskInput.description}
                      onChange={(e) => setCustomTaskInput({ ...customTaskInput, description: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleAddCustomTask}
                    disabled={!customTaskInput.task}
                    className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 hover:border-amber-500/60 transition-all rounded-2xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add to Request
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomTaskForm(true)}
                className="w-full mt-2 p-3 border border-dashed border-slate-700 rounded-3xl text-slate-400 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-800/30 transition-all text-xs font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Custom Part Replacement Request
              </button>
            )}

          </div>
        </div>

        {/* Right Column: Interactive Budget, Rates, and Quote Breakdown */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                Cost Calculation Parameters
              </span>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-xl border border-amber-500/30 font-semibold">
                Live Dynamic
              </span>
            </div>

            {/* Adjustable Inputs */}
            <div className="space-y-3 font-sans text-xs">
              {/* Labor Rate Per Hour */}
              <div>
                <div className="flex items-center justify-between text-slate-300 mb-1">
                  <label htmlFor="input-labor-rate" className="text-[11px] text-slate-400">Workshop Labor Rate (₹/hr):</label>
                  <span className="font-mono font-bold text-slate-100">₹{laborRatePerHour}/hr</span>
                </div>
                <input
                  id="input-labor-rate"
                  type="range"
                  min="400"
                  max="1200"
                  step="50"
                  value={laborRatePerHour}
                  onChange={(e) => setLaborRatePerHour(Number(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-2xl cursor-pointer"
                />
              </div>

              {/* Fleet Discount Percentage */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="select-fleet-discount" className="block text-[11px] text-slate-400 mb-1">Fleet Corporate Discount:</label>
                  <select
                    id="select-fleet-discount"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-amber-400"
                  >
                    <option value={0}>0% (Standard)</option>
                    <option value={5}>5% (Silver Fleet)</option>
                    <option value={10}>10% (Gold Fleet)</option>
                    <option value={15}>15% (Enterprise Master)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="select-consumables" className="block text-[11px] text-slate-400 mb-1">Shop Supplies & Fluids:</label>
                  <select
                    id="select-consumables"
                    value={shopSuppliesRate}
                    onChange={(e) => setShopSuppliesRate(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-amber-400"
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={3}>3% Standard</option>
                    <option value={4}>4% Workshop Lube</option>
                    <option value={6}>6% Heavy Consumables</option>
                  </select>
                </div>
              </div>

              {/* GST 18% Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400">Apply GST (18% Commercial Auto Spares & Labor):</span>
                <button
                  type="button"
                  onClick={() => setIncludeGst(!includeGst)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all border shrink-0 ${
                    includeGst
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {includeGst ? '18% GST Applied' : 'Tax Exempt'}
                </button>
              </div>
            </div>

            {/* Financial Itemized Breakdown */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Selected Tasks:</span>
                <span className="text-slate-200 font-bold">{selectedTasks.length} items</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span>Total Labor ({totalLaborHours.toFixed(1)} hrs @ ₹{laborRatePerHour}):</span>
                <span className="text-slate-200">₹{Math.round(grossLaborCost).toLocaleString('en-IN')}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span>Total OEM Spare Parts:</span>
                <span className="text-slate-200">₹{grossPartsCost.toLocaleString('en-IN')}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>Fleet Rebate ({discountPercent}%):</span>
                  <span>-₹{Math.round(discountAmount).toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-400">
                <span>Consumables & Shop Supplies ({shopSuppliesRate}%):</span>
                <span className="text-slate-200">₹{Math.round(shopSuppliesCost).toLocaleString('en-IN')}</span>
              </div>

              {includeGst && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>GST (18% CGST + SGST):</span>
                  <span className="text-slate-200">₹{Math.round(gstAmount).toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="border-t border-slate-700 pt-2 flex items-center justify-between text-sm">
                <span className="font-bold text-slate-100 font-sans">Total Estimated Cost:</span>
                <span className="font-bold text-amber-400 text-base font-mono">
                  ₹{Math.round(grandTotalEstimate).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Execution Actions */}
          <div className="pt-2 space-y-2">
            {appliedSuccess && (
              <div className="p-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Added to Workshop Work Order!</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Print Quote</span>
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="w-full py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Apply to Order</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
