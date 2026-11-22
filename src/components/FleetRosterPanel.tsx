import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  User,
  MapPin,
  Clock,
  ChevronRight,
  Shield,
  Gauge,
  Calendar,
} from 'lucide-react';
import { FleetVehicle, AuthUser, VehicleStatus } from '../types';
import { vehicleStatusTone } from '../services/fleetView';

interface FleetRosterPanelProps {
  vehicles: FleetVehicle[];
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
  onOpenAddVehicle: () => void;
  currentUser: AuthUser | null;
  onInspectVehicle: (id: string) => void;
}

export const FleetRosterPanel: React.FC<FleetRosterPanelProps> = ({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  onOpenAddVehicle,
  currentUser,
  onInspectVehicle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'NORMAL' | 'WARNING' | 'CRITICAL'>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const getVehicleStatus = (v: FleetVehicle): 'NORMAL' | 'WARNING' | 'CRITICAL' => {
    if (v.status) return v.status as any;
    const dtcCount = v.telemetry?.active_dtc_codes?.length || 0;
    if (dtcCount >= 2 || (v.telemetry?.coolant_temp_c && v.telemetry.coolant_temp_c > 105)) return 'CRITICAL';
    if (dtcCount > 0 || (v.telemetry?.coolant_temp_c && v.telemetry.coolant_temp_c > 98)) return 'WARNING';
    return 'NORMAL';
  };

  const availableStates = Array.from(
    new Set(
      vehicles
        .map((v) => v.state || (v.location?.includes('J&K') ? 'Jammu & Kashmir' : v.location?.includes('Punjab') ? 'Punjab' : v.location?.includes('Odisha') ? 'Odisha' : ''))
        .filter(Boolean)
    )
  );

  const filteredVehicles = vehicles.map((v) => ({ ...v, computedStatus: getVehicleStatus(v) })).filter((v) => {
    const query = searchQuery.toLowerCase();
    const driver = (v.driver_name || v.driver || '').toLowerCase();
    const payload = (v.payload || v.load_type || '').toLowerCase();
    const state = (v.state || '').toLowerCase();
    const matchesSearch =
      v.vehicle_id.toLowerCase().includes(query) ||
      (v.unit_name && v.unit_name.toLowerCase().includes(query)) ||
      (v.make_model && v.make_model.toLowerCase().includes(query)) ||
      driver.includes(query) ||
      payload.includes(query) ||
      state.includes(query) ||
      (v.vin && v.vin.toLowerCase().includes(query)) ||
      (v.location && v.location.toLowerCase().includes(query));

    const matchesStatus = statusFilter === 'all' || v.computedStatus === statusFilter;
    const matchesState =
      stateFilter === 'all' ||
      v.state === stateFilter ||
      (v.location && v.location?.includes(stateFilter)) ||
      (stateFilter === 'Jammu & Kashmir' && v.location?.includes('J&K'));

    return matchesSearch && matchesStatus && matchesState;
  });

  const normalCount = vehicles.filter((v) => getVehicleStatus(v) === 'NORMAL').length;
  const warningCount = vehicles.filter((v) => getVehicleStatus(v) === 'WARNING').length;
  const criticalCount = vehicles.filter((v) => getVehicleStatus(v) === 'CRITICAL').length;

  return (
    <div className="space-y-6">
      {/* Fleet Banner & Statistics */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3.5 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-100 uppercase tracking-wide">
                Commercial Fleet Operations Roster
              </h2>
              <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300 font-semibold shrink-0">
                {vehicles.length} Units Active
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1 font-mono">
              Real-time SAE J1939 telematics monitoring, active fault diagnostics, and unit dispatch.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="fleet-roster-add-unit-btn"
              onClick={onOpenAddVehicle}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Fleet Vehicle</span>
            </button>
          </div>
        </div>

        {/* Quick Fleet Health Counter Ribbons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Total Roster</div>
            <div className="text-xl font-bold text-slate-100 font-mono mt-0.5">{vehicles.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Heavy-Duty Haulers</div>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'NORMAL' ? 'all' : 'NORMAL')}
            className={`cursor-pointer bg-slate-950/60 border rounded-2xl p-3 transition-colors ${
              statusFilter === 'NORMAL' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-mono text-emerald-400 uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Nominal
            </div>
            <div className="text-xl font-bold text-emerald-300 font-mono mt-0.5">{normalCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">In Service • No Active DTCs</div>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'WARNING' ? 'all' : 'WARNING')}
            className={`cursor-pointer bg-slate-950/60 border rounded-2xl p-3 transition-colors ${
              statusFilter === 'WARNING' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-mono text-amber-400 uppercase flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Warning (Amber)
            </div>
            <div className="text-xl font-bold text-amber-300 font-mono mt-0.5">{warningCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Service Soon • Moderate DTCs</div>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'CRITICAL' ? 'all' : 'CRITICAL')}
            className={`cursor-pointer bg-slate-950/60 border rounded-2xl p-3 transition-colors ${
              statusFilter === 'CRITICAL' ? 'border-rose-500 bg-rose-500/10' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-mono text-rose-400 uppercase flex items-center gap-1">
              <AlertOctagon className="w-3 h-3" /> Critical (Red)
            </div>
            <div className="text-xl font-bold text-rose-300 font-mono mt-0.5">{criticalCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Immediate Workshop Stop</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="fleet-roster-search-input"
              type="text"
              placeholder="Search by ID, state, driver, VIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-100 placeholder-slate-400 font-mono focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 text-xs font-mono">
            <span className="text-slate-400 text-[11px] mr-1 hidden md:inline">Status:</span>
            {(['all', 'NORMAL', 'WARNING', 'CRITICAL'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-2xl transition-all ${
                  statusFilter === filter
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {filter === 'all' ? 'All Statuses' : filter}
              </button>
            ))}
          </div>
        </div>

        {/* State / Regional Filter Pills */}
        {availableStates.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-mono">
            <span className="text-slate-400 text-[11px] flex items-center gap-1 shrink-0">
              <MapPin className="w-3.5 h-3.5 text-sky-400" /> State:
            </span>
            <button
              onClick={() => setStateFilter('all')}
              className={`px-2.5 py-1 rounded-xl text-[11px] whitespace-nowrap transition-all border ${
                stateFilter === 'all'
                  ? 'bg-sky-500/20 text-sky-300 font-bold border-sky-500/50'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              All Regions ({vehicles.length})
            </button>
            {availableStates.map((st) => {
              const count = vehicles.filter(
                (v) => v.state === st || (v.location && v.location?.includes(st)) || (st === 'Jammu & Kashmir' && v.location?.includes('J&K'))
              ).length;
              return (
                <button
                  key={st}
                  onClick={() => setStateFilter(stateFilter === st ? 'all' : st)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] whitespace-nowrap transition-all border flex items-center gap-1 ${
                    stateFilter === st
                      ? 'bg-sky-500/20 text-sky-300 font-bold border-sky-500/50'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800'
                  }`}
                >
                  <span>{st}</span>
                  <span className="text-[10px] opacity-75 font-bold">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Vehicle Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {filteredVehicles.map((vehicle) => {
          const isSelected = vehicle.vehicle_id === selectedVehicleId;
          const dtcCount = vehicle.telemetry?.active_dtc_codes?.length || 0;

          return (
            <div
              key={vehicle.vehicle_id}
              id={`vehicle-card-${vehicle.vehicle_id}`}
              className={`bg-slate-900 border rounded-3xl p-4 transition-all duration-150 flex flex-col justify-between ${
                isSelected
                  ? 'border-amber-400 shadow-md shadow-amber-400/10 ring-1 ring-amber-400/30'
                  : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div>
                {/* Header: ID, Status & Active DTC count */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 min-w-0">
                      <span className="text-sm font-bold font-mono text-slate-100 [overflow-wrap:anywhere]" title={vehicle.vehicle_id}>
                        {vehicle.vehicle_id}
                      </span>
                      {vehicle.state && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold flex items-center gap-0.5 whitespace-nowrap shrink-0">
                          <MapPin className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                          {vehicle.state}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 font-medium line-clamp-2 mt-0.5" title={vehicle.unit_name}>
                      {vehicle.unit_name}
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        vehicleStatusTone(vehicle.status) === 'critical'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : vehicleStatusTone(vehicle.status) === 'warning'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {vehicle.status}
                    </span>

                    {dtcCount > 0 ? (
                      <span className="text-[10px] font-mono text-rose-400 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {dtcCount} DTC{dtcCount > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> 0 Faults
                      </span>
                    )}
                  </div>
                </div>

                {/* Vehicle Specs & Details */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 space-y-1.5 font-mono text-xs mb-3">
                  <div className="flex items-start justify-between text-slate-300">
                    <span className="text-slate-400 text-[11px] shrink-0 mr-3">Make / Model:</span>
                    <span className="font-semibold min-w-0 text-right line-clamp-2 [overflow-wrap:anywhere]" title={vehicle.make_model}>
                      {vehicle.make_model || 'Class 8 Commercial Truck'}
                    </span>
                  </div>

                  {vehicle.year && (
                    <div className="flex items-start justify-between text-slate-300">
                      <span className="text-slate-400 text-[11px] shrink-0 mr-3">Year & VIN:</span>
                      <span className="text-slate-300 text-[11px]">
                        {vehicle.year} • <span className="text-slate-400">{vehicle.vin?.slice(-6) || 'N/A'}</span>
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between text-slate-300">
                    <span className="text-slate-400 text-[11px] shrink-0 mr-3">Engine Hours:</span>
                    <span className="text-amber-300 font-bold">
                      {vehicle.engine_hours?.toLocaleString()} hrs
                    </span>
                  </div>

                  {(vehicle.driver_name || vehicle.driver) && (
                    <div className="flex items-start justify-between text-slate-300">
                      <span className="text-slate-400 text-[11px] shrink-0 mr-3">Operator / Driver:</span>
                      <span className="text-slate-200 min-w-0 text-right line-clamp-2 [overflow-wrap:anywhere]" title={vehicle.driver_name || vehicle.driver}>
                        {vehicle.driver_name || vehicle.driver}
                      </span>
                    </div>
                  )}

                  {(vehicle.payload || vehicle.load_type) && (
                    <div className="flex items-start justify-between text-slate-300">
                      <span className="text-slate-400 text-[11px] shrink-0 mr-3">Load & Payload:</span>
                      <span className="text-amber-300 text-[11px] font-medium min-w-0 text-right line-clamp-2 [overflow-wrap:anywhere]" title={vehicle.payload || vehicle.load_type}>
                        {vehicle.payload || vehicle.load_type}
                      </span>
                    </div>
                  )}

                  {vehicle.gvw_tons && (
                    <div className="flex items-start justify-between text-slate-300">
                      <span className="text-slate-400 text-[11px] shrink-0 mr-3">Gross Wt (GVW):</span>
                      <span className="text-slate-200 text-[11px] font-bold">
                        {vehicle.gvw_tons} Tonnes
                      </span>
                    </div>
                  )}

                  {vehicle.location && (
                    <div className="flex items-start justify-between text-slate-300">
                      <span className="text-slate-400 text-[11px] shrink-0 mr-3">Route / Corridor:</span>
                      <span
                        className="text-slate-200 min-w-0 text-right line-clamp-2 [overflow-wrap:anywhere] text-[11px] font-medium cursor-help"
                        title={`${vehicle.state ? `[${vehicle.state}] ` : ''}${vehicle.location}`}
                      >
                        {vehicle.location}
                      </span>
                    </div>
                  )}
                </div>

                {/* Real-time Telemetry Snapshot Preview */}
                {vehicle.telemetry && (
                  <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[10px] mb-3">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-1.5">
                      <div className="text-slate-400">SPEED</div>
                      <div className="font-bold text-slate-200 mt-0.5 leading-tight">
                        {vehicle.telemetry.speed_kmh ?? 0} km/h
                      </div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-1.5">
                      <div className="text-slate-400">RPM</div>
                      <div className="font-bold text-slate-200 mt-0.5 leading-tight">
                        {vehicle.telemetry.engine_rpm ?? Math.round((vehicle.telemetry.speed_kmh ?? 0) * 22.5)}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-1.5 overflow-hidden">
                      <div className="text-slate-400 truncate text-[9px]">TPMS</div>
                      <div
                        className={`font-bold mt-0.5 leading-tight ${
                          (vehicle.telemetry.tire_pressure_psi ?? 100) < 90
                            ? 'text-rose-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {vehicle.telemetry.tire_pressure_psi ?? 100} psi
                      </div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-1.5 overflow-hidden">
                      <div className="text-slate-400 truncate text-[9px]">COOLANT</div>
                      <div
                        className={`font-bold mt-0.5 leading-tight ${
                          (vehicle.telemetry.coolant_temp_c ?? 85) > 105
                            ? 'text-rose-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {vehicle.telemetry.coolant_temp_c ?? 85}°C
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                <button
                  id={`select-unit-btn-${vehicle.vehicle_id}`}
                  onClick={() => onInspectVehicle(vehicle.vehicle_id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-2xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-400/40'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'Diagnosing Now' : 'Diagnose Unit'}</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-3xl p-8">
          <Truck className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-60" />
          <h3 className="text-sm font-bold text-slate-200">No matching fleet vehicles found</h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Try adjusting your search criteria or add a new vehicle to the fleet.
          </p>
          <button
            onClick={onOpenAddVehicle}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Commercial Vehicle</span>
          </button>
        </div>
      )}
    </div>
  );
};
