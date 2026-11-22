import React, { useEffect, useState } from 'react';
import { X, Printer, Truck, Database, Check } from 'lucide-react';
import { DiagnosticResult, VehicleSnapshot, FleetVehicle } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { saveWorkOrder } from '../services/fleetApi';

interface WorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: VehicleSnapshot;
  result: DiagnosticResult | null;
  vehicleMeta?: FleetVehicle;
}

export const WorkOrderModal: React.FC<WorkOrderModalProps> = ({
  isOpen,
  onClose,
  snapshot,
  result,
  vehicleMeta,
}) => {
  useBodyScrollLock(isOpen);
  const [isSavedToDb, setIsSavedToDb] = useState(false);

  const workOrderNumber = `WO-${snapshot.vehicle_id}-${new Date().getFullYear()}${(new Date().getMonth() + 1)
    .toString()
    .padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-01`;

  const totalEstPartsInr = (result?.required_parts.length || 2) * 12500;
  const totalEstLaborInr = result?.status === 'CRITICAL_STOP' ? 18000 : 7500;
  const grandTotalInr = totalEstPartsInr + totalEstLaborInr;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    saveWorkOrder(workOrderNumber, snapshot.vehicle_id, grandTotalInr, 'OPEN')
      .then(() => setIsSavedToDb(true))
      .catch((err) => console.warn('Could not save the work order on the server:', err));

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, workOrderNumber, snapshot.vehicle_id, grandTotalInr]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const sootGrams = snapshot.telemetry.soot_level_g ?? 24.5;
  const speedKmh = snapshot.telemetry.speed_kmh ?? Math.round((snapshot.telemetry.speed_mph ?? 58) * 1.60934);
  const instantKml = snapshot.telemetry.instant_kml ?? Number(((snapshot.telemetry.instant_mpg ?? 5.18) * 0.425144).toFixed(2));
  const fuelRateLph = snapshot.telemetry.fuel_rate_lph ?? Number(((snapshot.telemetry.fuel_rate_gph ?? 11.2) * 3.78541).toFixed(1));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-slate-100 p-6 md:p-8"
      >
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6 no-print">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold font-display leading-tight">Workshop Work Order & Dispatch Ticket</h3>
            {isSavedToDb && (
              <span className="hidden sm:flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>Cloud Synced</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Print Work Order</span>
              <span className="sm:hidden">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE TICKET BODY */}
        <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl shadow-inner font-sans print:shadow-none print:p-0">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight font-mono text-slate-950">FLEETDIAG AI</span>
                <span className="text-xs bg-slate-900 text-white font-mono px-2 py-0.5 rounded-xl font-bold">
                  TATA MOTORS BSVI WORKSHOP DISPATCH
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">SAE J1939 Telemetry & BSVI DTC Automated Diagnostic Report</p>
            </div>

            <div className="text-right font-mono text-xs">
              <p className="font-bold text-slate-900 text-sm">{workOrderNumber}</p>
              <p className="text-slate-600">{new Date().toLocaleString()}</p>
            </div>
          </div>

          {/* Vehicle Info Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-100 rounded-2xl mb-6 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Vehicle / Unit ID</span>
              <strong className="text-slate-900 text-sm">{snapshot.vehicle_id}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Make / Model</span>
              <strong className="text-slate-900">{vehicleMeta?.make_model || 'Vehicle'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Engine Hours</span>
              <strong className="text-slate-900">{snapshot.engine_hours.toLocaleString()} hrs</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Assigned Driver / VIN</span>
              <strong className="text-slate-900 truncate block">
                {vehicleMeta?.driver || 'Fleet Driver'} / {vehicleMeta?.vin?.slice(-8) || 'N/A'}
              </strong>
            </div>
          </div>

          {/* Telemetry Snapshot at Incident (with Metric & Soot) */}
          <div className="mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-2">
              Incident Sensor Snapshot Data (Metric / Indian Standard)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs font-mono">
              <div className="p-2 border border-slate-300 rounded-xl bg-slate-50">
                <span className="text-[10px] text-slate-500 block">Coolant Temp</span>
                <strong className={snapshot.telemetry.coolant_temp_c >= 105 ? 'text-red-600 text-sm' : 'text-slate-900'}>
                  {snapshot.telemetry.coolant_temp_c}°C
                </strong>
              </div>
              <div className="p-2 border border-slate-300 rounded-xl bg-slate-50">
                <span className="text-[10px] text-slate-500 block">Bus Voltage</span>
                <strong className={snapshot.telemetry.battery_voltage_v < 24 ? 'text-red-600 text-sm' : 'text-slate-900'}>
                  {snapshot.telemetry.battery_voltage_v} V
                </strong>
              </div>
              <div className="p-2 border border-slate-300 rounded-xl bg-slate-50">
                <span className="text-[10px] text-slate-500 block">DPF Soot Mass</span>
                <strong className={sootGrams >= 28 ? 'text-red-600 text-sm' : 'text-slate-900'}>
                  {sootGrams.toFixed(1)} g
                </strong>
              </div>
              <div className="p-2 border border-slate-300 rounded-xl bg-slate-50">
                <span className="text-[10px] text-slate-500 block">Exhaust EGT</span>
                <strong className={snapshot.telemetry.exhaust_temp_c >= 620 ? 'text-red-600' : 'text-slate-900'}>
                  {snapshot.telemetry.exhaust_temp_c}°C
                </strong>
              </div>
              <div className="p-2 border border-slate-300 rounded-xl bg-slate-50">
                <span className="text-[10px] text-slate-500 block">NOx PPM</span>
                <strong className={snapshot.telemetry.nox_sensor_ppm >= 1000 ? 'text-red-600 text-sm' : 'text-slate-900'}>
                  {snapshot.telemetry.nox_sensor_ppm}
                </strong>
              </div>
              <div className="p-2 border border-slate-300 rounded-xl bg-slate-50">
                <span className="text-[10px] text-slate-500 block">Road Speed</span>
                <strong className="text-slate-900">{speedKmh} KMPH</strong>
              </div>
              <div className="p-2 border border-slate-300 rounded-xl bg-slate-50">
                <span className="text-[10px] text-slate-500 block">Fuel Economy</span>
                <strong className="text-slate-900">{instantKml} km/l</strong>
              </div>
            </div>
          </div>

          {/* AI Assessment */}
          {result && (
            <div className="border border-slate-300 rounded-2xl p-4 mb-6 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs uppercase text-slate-600 font-mono">
                  AI Diagnostic Evaluation & Urgency
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-xl ${
                    result.status === 'CRITICAL_STOP'
                      ? 'bg-red-100 text-red-700 border border-red-300'
                      : result.status === 'WARNING'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  STATUS: {result.status} (HEALTH: {result.health_score}/100)
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-900 leading-snug mb-2">
                {result.primary_diagnosis}
              </p>
              <div className="flex justify-between items-center text-xs text-slate-600 font-mono">
                <span>
                  Predicted 24-Hour Failure Probability: <strong>{result.failure_probability_next_24h}%</strong>
                </span>
                <span>
                  Estimated Total Quotation: <strong className="text-slate-900 text-sm">₹{grandTotalInr.toLocaleString('en-IN')}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Required Parts Requisition with Prices in INR */}
          {result && (
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-2">
                Required Parts Requisition & Tariff (INR ₹)
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-300">
                <table className="w-full text-xs font-mono border-collapse border-0 min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border-b border-r border-slate-300 p-2 text-left">Item / Description</th>
                      <th className="border-b border-r border-slate-300 p-2 text-center w-16">Qty</th>
                      <th className="border-b border-r border-slate-300 p-2 text-center w-28">Part Number</th>
                      <th className="border-b border-r border-slate-300 p-2 text-right w-28">Est. Price (₹)</th>
                      <th className="border-b border-slate-300 p-2 text-center w-20">Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.required_parts.map((part, i) => (
                      <tr key={i} className="border-b border-slate-300">
                        <td className="border-r border-slate-300 p-2 text-slate-900 font-medium">{part}</td>
                        <td className="border-r border-slate-300 p-2 text-center">1</td>
                        <td className="border-r border-slate-300 p-2 text-center text-slate-600">TATA-OEM</td>
                        <td className="border-r border-slate-300 p-2 text-right text-slate-800">₹12,500</td>
                        <td className="p-2 text-center">[ &nbsp; ]</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold border-b border-slate-300">
                      <td colSpan={3} className="border-r border-slate-300 p-2 text-right text-slate-700">
                        Estimated Labor & Diagnosis Tariff:
                      </td>
                      <td className="border-r border-slate-300 p-2 text-right text-slate-900">
                        ₹{totalEstLaborInr.toLocaleString('en-IN')}
                      </td>
                      <td className="p-2 text-center"></td>
                    </tr>
                    <tr className="bg-slate-100 font-black">
                      <td colSpan={3} className="border-r border-slate-300 p-2 text-right text-slate-900">
                        Total Estimated Workshop Invoice:
                      </td>
                      <td className="border-r border-slate-300 p-2 text-right text-slate-900 text-sm">
                        ₹{grandTotalInr.toLocaleString('en-IN')}
                      </td>
                      <td className="p-2 text-center"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Technician Action Steps */}
          {result && (
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-2">
                Expected Plan of Action for Repairs (Checklist)
              </h4>
              <div className="space-y-2 text-xs">
                {result.action_plan.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b border-slate-200 pb-1.5">
                    <span className="font-mono text-slate-500 font-bold">[ &nbsp; ] {idx + 1}.</span>
                    <span className="text-slate-800 leading-tight">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sign-off lines */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-900 text-xs font-mono mt-8">
            <div>
              <div className="border-b border-slate-400 h-8 mb-1"></div>
              <span className="text-slate-600">Master Technician Signature / Tata Motors Certified</span>
            </div>
            <div>
              <div className="border-b border-slate-400 h-8 mb-1"></div>
              <span className="text-slate-600">Shop Foreman Release & Test-Drive Approval</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
