import React, { useEffect } from 'react';
import {
  X,
  Radio,
  MapPin,
  Compass,
  Truck,
  Maximize2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { FleetVehicle, VehicleStatus } from '../types';
import { GoogleMapsLiveTracking } from './GoogleMapsLiveTracking';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface LiveTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: FleetVehicle;
  allVehicles?: FleetVehicle[];
  status?: VehicleStatus;
  speedKmh?: number;
  onSelectVehicle?: (vehicleId: string) => void;
}

export const LiveTrackingModal: React.FC<LiveTrackingModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  allVehicles = [],
  status = 'HEALTHY',
  speedKmh,
  onSelectVehicle,
}) => {
  // Completely lock the background homepage from scrolling while this modal is open
  useBodyScrollLock(isOpen);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const latFormatted = `${Math.abs(vehicle.coordinates?.lat ?? 18.7546).toFixed(4)}° ${
    (vehicle.coordinates?.lat ?? 18.7546) >= 0 ? 'N' : 'S'
  }`;
  const lngFormatted = `${Math.abs(vehicle.coordinates?.lng ?? 73.3426).toFixed(4)}° ${
    (vehicle.coordinates?.lng ?? 73.3426) >= 0 ? 'E' : 'W'
  }`;

  return (
    <div
      id="live-tracking-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-tracking-modal-title"
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative text-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="live-tracking-modal-title" className="text-sm sm:text-base font-bold text-slate-100 font-sans tracking-tight">
                  Commercial Fleet Live Telematics & GPS Tracking Feed
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE GOOGLE MAPS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {vehicle.state ? `${vehicle.state} • ` : ''}Corridor: {vehicle.coordinates?.route_corridor || vehicle.location} • Driver: {vehicle.driver}
              </p>
            </div>
          </div>

          {/* Controls: Vehicle Quick Switcher & Close */}
          <div className="flex items-center gap-2 shrink-0">
            {allVehicles.length > 1 && onSelectVehicle && (
              <div className="relative">
                <select
                  value={vehicle.vehicle_id}
                  onChange={(e) => onSelectVehicle(e.target.value)}
                  className="bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-2xl px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer pr-7 appearance-none"
                  title="Switch tracked fleet unit"
                >
                  {allVehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.vehicle_id} • {v.state ? `[${v.state}] ` : ''}{v.unit_name.slice(0, 20)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>
            )}

            <button
              onClick={onClose}
              id="close-live-tracking-modal-btn"
              className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Live Tracking (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Google Maps Live Tracking Component */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-950">
          <GoogleMapsLiveTracking
            vehicle={vehicle}
            allVehicles={allVehicles}
            status={status}
            speedKmh={speedKmh}
            onSelectVehicle={onSelectVehicle}
            className="w-full h-full min-h-[420px] sm:min-h-[520px]"
          />
        </div>

        {/* Modal Bottom Diagnostics Strip */}
        <div className="bg-slate-950/90 px-4 py-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shrink-0">
          <div className="flex items-center gap-3 text-slate-400 text-[11px] flex-wrap">
            <span className="flex items-center gap-1 text-slate-200">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>{vehicle.vehicle_id} ({vehicle.make_model})</span>
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span>Speed: <strong className="text-cyan-400">{speedKmh ?? vehicle.telemetry.speed_kmh} KMPH</strong></span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span>Tire: <strong className="text-emerald-400">{vehicle.telemetry.tire_pressure_psi ?? 84} PSI</strong></span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span>Elevation: <strong className="text-slate-300">{vehicle.coordinates?.altitude_m ?? 500} m</strong></span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Coordinates: <strong className="text-amber-400">{latFormatted}, {lngFormatted}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
