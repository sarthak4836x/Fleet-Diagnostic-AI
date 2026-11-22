import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  Plus,
  X,
  MapPin,
  Compass,
  Gauge,
  User,
  Hash,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { FleetVehicle, TelemetryData } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { vehicleIdError } from '../services/fleetView';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVehicle: (newVehicle: FleetVehicle) => void | Promise<void>;
  existingVehicleIds?: string[];
}

const MAKE_MODEL_PRESETS = [
  'Tata Prima 5530.S (Cummins ISBe 6.7L BSVI 300HP Tractor)',
  'Tata Signa 4825.TK (BSVI Cummins ISBe 250HP Bogie Tipper)',
  'Tata Signa 2823.K (3.3L Turbotronn NG Bosch MD1CS018)',
  'Tata Ultra T.16 Sleek (3.3L Turbotronn NG 160HP)',
  'Tata LPT 1918 Cowl (5.0L Turbotronn 180HP Long-Haul)',
  'Tata Prima 3530.K (Cummins ISBe 6.7L Heavy Tipper)',
  'Tata Signa 5530.S (Cummins ISBe 300HP Multi-Axle Carrier)',
  'Tata Ultra 1918.T (Turbotronn 180HP Container Spec)',
];

const CORRIDOR_PRESETS = [
  {
    name: 'NH-44 Banihal-Qazigund Himalayan Corridor (J&K)',
    lat: 33.5186,
    lng: 75.1950,
    altitude: 1790,
    landmark: 'Navyug Banihal-Qazigund Twin-Tube Tunnel (Pir Panjal Pass)',
    location: 'NH-44 Trans-Himalayan Highway, Banihal, Jammu & Kashmir',
    state: 'Jammu & Kashmir',
  },
  {
    name: 'NH-44 Grand Trunk (GT) Road Agricultural Arterial (Punjab)',
    lat: 30.4350,
    lng: 76.7120,
    altitude: 278,
    landmark: 'Shambhu Inter-State Commercial Barrier & Markfed Grain Terminal',
    location: 'NH-44 GT Road, Shambhu Border Toll Plaza, Rajpura, Punjab',
    state: 'Punjab',
  },
  {
    name: 'NH-520 Keonjhar-Kalinganagar Mineral Express Highway (Odisha)',
    lat: 22.0120,
    lng: 85.4280,
    altitude: 465,
    landmark: 'Barbil-Joda Mineral Weighbridge & Rungta Mines Gate 2',
    location: 'SH-10 / NH-520 Joda-Barbil Iron Ore Mining Belt, Keonjhar, Odisha',
    state: 'Odisha',
  },
  {
    name: 'NE-1 / NH-48 Dahej Chemical SEZ Expressway (Gujarat)',
    lat: 21.7140,
    lng: 72.9820,
    altitude: 22,
    landmark: 'Dahej Petroleum & Petrochemicals SEZ Gate 1 Weigh Station',
    location: 'NE-1 / NH-48 Dahej Chemical SEZ Expressway, Bharuch, Gujarat',
    state: 'Gujarat',
  },
  {
    name: 'NH-48 Mumbai-Pune Expressway (KM 64 Bhor Ghat, Maharashtra)',
    lat: 18.7546,
    lng: 73.3426,
    altitude: 595,
    landmark: 'Bhor Ghat Viaduct Section (KM 64)',
    location: 'Mumbai-Pune Expressway (NH-48), Maharashtra',
    state: 'Maharashtra',
  },
  {
    name: 'NH-348 JNPT Port Container Freight Corridor (Maharashtra)',
    lat: 18.9482,
    lng: 73.0125,
    altitude: 14,
    landmark: 'JNPT Port Container Terminal 4 Approach',
    location: 'NH-348 Nhava Sheva Freight Corridor, Navi Mumbai, MH',
    state: 'Maharashtra',
  },
  {
    name: 'NH-44 Bengaluru-Hosur-Chennai Auto Artery (Tamil Nadu)',
    lat: 12.7820,
    lng: 77.8180,
    altitude: 875,
    landmark: 'Zuzuvadi Inter-State Commercial Border & TVS Industrial Hub',
    location: 'NH-44 Auto Logistics Artery, Hosur Border, Tamil Nadu',
    state: 'Tamil Nadu',
  },
  {
    name: 'NH-18 Jamshedpur Steel Freight Arterial (Jharkhand)',
    lat: 22.8050,
    lng: 86.2020,
    altitude: 165,
    landmark: 'Tata Steel Jamshedpur Works Logistics Gate 3 (Burmamines)',
    location: 'NH-18 Tata Steel Logistics Corridor, Jamshedpur, Jharkhand',
    state: 'Jharkhand',
  },
  {
    name: 'NH-48 Western Dedicated Freight Corridor (Neemrana, Rajasthan)',
    lat: 27.9890,
    lng: 76.3880,
    altitude: 310,
    landmark: 'Neemrana Japanese Industrial Zone & Shahjahanpur Toll',
    location: 'NH-48 Jaipur-Delhi Freight Highway, Neemrana, Rajasthan',
    state: 'Rajasthan',
  },
];

export const AddVehicleModal: React.FC<AddVehicleModalProps> = ({
  isOpen,
  onClose,
  onAddVehicle,
  existingVehicleIds = [],
}) => {
  const [vehicleId, setVehicleId] = useState('');
  const [unitName, setUnitName] = useState('');
  const [makeModel, setMakeModel] = useState(MAKE_MODEL_PRESETS[0]);
  const [year, setYear] = useState(2023);
  const [vin, setVin] = useState('');
  const [driver, setDriver] = useState('');
  const [engineHours, setEngineHours] = useState(6500);
  const [selectedCorridorIndex, setSelectedCorridorIndex] = useState(0);
  const [customLocation, setCustomLocation] = useState('');
  const [customLat, setCustomLat] = useState<number>(18.7500);
  const [customLng, setCustomLng] = useState<number>(73.4000);
  const [telemetryPreset, setTelemetryPreset] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(isOpen);

  // The submit button is at the bottom of a long form, and the message is at the top
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [error]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const generateVin = () => {
    const chars = '1234567890ABCDEFGHJKLMNPRSTUVWXYZ';
    let res = 'MAT416';
    for (let i = 0; i < 11; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setVin(res);
  };

  const handleCorridorChange = (index: number) => {
    setSelectedCorridorIndex(index);
    if (index >= 0 && index < CORRIDOR_PRESETS.length) {
      const p = CORRIDOR_PRESETS[index];
      setCustomLocation(p.location);
      setCustomLat(p.lat);
      setCustomLng(p.lng);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitVehicle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The vehicle could not be saved. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitVehicle = async () => {
    const cleanId = vehicleId.trim().toUpperCase();
    const idProblem = vehicleIdError(cleanId);
    if (idProblem) {
      setError(idProblem);
      return;
    }

    if (existingVehicleIds.includes(cleanId)) {
      setError(`Vehicle ID "${cleanId}" already exists in the fleet database. Choose another ID.`);
      return;
    }

    const cleanUnitName = unitName.trim() || `Unit ${cleanId}`;
    const cleanDriver = driver.trim() || 'Unassigned Reserve Driver';
    const cleanVin = vin.trim() || `1M8G${Math.random().toString(36).substring(2, 15).toUpperCase()}`;

    const corridor = CORRIDOR_PRESETS[selectedCorridorIndex] || CORRIDOR_PRESETS[0];
    const finalLocation = customLocation.trim() || corridor.location;

    // Generate telemetry payload based on selected preset
    let initialTelemetry: TelemetryData;
    if (telemetryPreset === 'healthy') {
      initialTelemetry = {
        engine_load_pct: 42,
        coolant_temp_c: 88,
        battery_voltage_v: 28.2,
        exhaust_temp_c: 380,
        nox_sensor_ppm: 120,
        active_dtc_codes: [],
        soot_level_g: 9.4,
        speed_kmh: 74,
        speed_mph: 46,
        fuel_rate_lph: 18.2,
        fuel_rate_gph: 4.8,
        instant_kml: 5.35,
        instant_mpg: 7.2,
        tire_pressure_psi: 104,
        idle_pct: 12,
        rail_pressure_bar: 1650,
        def_level_pct: 78,
      };
    } else if (telemetryPreset === 'warning') {
      initialTelemetry = {
        engine_load_pct: 76,
        coolant_temp_c: 98,
        battery_voltage_v: 24.8,
        exhaust_temp_c: 540,
        nox_sensor_ppm: 780,
        active_dtc_codes: ['P2463'], // DPF Soot Accumulation warning
        soot_level_g: 27.5,
        speed_kmh: 68,
        speed_mph: 42,
        fuel_rate_lph: 29.4,
        fuel_rate_gph: 7.8,
        instant_kml: 4.1,
        instant_mpg: 5.5,
        tire_pressure_psi: 86,
        idle_pct: 28,
        rail_pressure_bar: 1420,
        def_level_pct: 42,
      };
    } else {
      // Critical fault
      initialTelemetry = {
        engine_load_pct: 88,
        coolant_temp_c: 106,
        battery_voltage_v: 23.4,
        exhaust_temp_c: 640,
        nox_sensor_ppm: 1350,
        active_dtc_codes: ['P244B-00', 'P2202'], // DPF Differential Pressure & NOx
        soot_level_g: 34.2,
        speed_kmh: 52,
        speed_mph: 32,
        fuel_rate_lph: 38.6,
        fuel_rate_gph: 10.2,
        instant_kml: 3.6,
        instant_mpg: 4.8,
        tire_pressure_psi: 82,
        idle_pct: 32,
        rail_pressure_bar: 1280,
        def_level_pct: 18,
      };
    }

    const newVehicle: FleetVehicle = {
      vehicle_id: cleanId,
      unit_name: cleanUnitName,
      make_model: makeModel,
      year: Number(year) || 2023,
      vin: cleanVin,
      driver: cleanDriver,
      location: finalLocation,
      state: corridor.state || 'India',
      coordinates: {
        lat: customLat || corridor.lat,
        lng: customLng || corridor.lng,
        heading: Math.floor(Math.random() * 360),
        altitude_m: corridor.altitude,
        landmark: corridor.landmark,
        route_corridor: corridor.name,
        state: corridor.state || 'India',
      },
      engine_hours: Number(engineHours) || 5000,
      telemetry: initialTelemetry,
      history: [
        {
          date: new Date().toISOString().split('T')[0],
          engine_hours: Number(engineHours) || 5000,
          avg_kml: initialTelemetry.instant_kml,
          coolant_temp_peak_c: initialTelemetry.coolant_temp_c,
          voltage_min_v: initialTelemetry.battery_voltage_v,
          dtc_logged: initialTelemetry.active_dtc_codes,
          notes: 'Vehicle registered and commissioned into active telematic fleet.',
        },
      ],
      notes: `Commissioned unit on ${new Date().toLocaleDateString()}. Initialized with ${telemetryPreset} baseline.`,
    };

    await onAddVehicle(newVehicle);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl text-slate-100 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-3xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-white">
                Add Commercial Heavy-Duty Vehicle to Fleet
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                SAE J1939 Telemetry Cluster & GPS Gateway Commissioning
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div ref={errorRef} role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          {/* Core Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Vehicle Unit ID * <span className="text-slate-500 font-normal">(e.g. FLEET-108)</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  placeholder="FLEET-108"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs font-mono text-slate-100 uppercase focus:outline-none focus:border-amber-400 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unit Name / Fleet Alias
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="e.g. Tata Prima Expressway 108"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Make, Model & Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Make & Model / Powertrain Spec
              </label>
              <select
                value={makeModel}
                onChange={(e) => setMakeModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              >
                {MAKE_MODEL_PRESETS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Model Year
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min={2015}
                  max={2026}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* VIN & Driver */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  VIN (17-Character)
                </label>
                <button
                  type="button"
                  onClick={generateVin}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-mono underline"
                >
                  Generate Random VIN
                </button>
              </div>
              <input
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="1M8G6CK8ML194042"
                maxLength={17}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs font-mono uppercase text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Assigned Pilot / Commercial Driver
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  placeholder="e.g. Vikram Patel"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Engine Hours & Starting Corridor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Initial Engine Hours
              </label>
              <div className="relative">
                <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={engineHours}
                  onChange={(e) => setEngineHours(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Freight Route Corridor / Corridor Preset
              </label>
              <select
                value={selectedCorridorIndex}
                onChange={(e) => handleCorridorChange(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              >
                {CORRIDOR_PRESETS.map((c, i) => (
                  <option key={c.name} value={i}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location & GPS Preview */}
          <div className="p-3.5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                GPS Telematics Telemetry Coordinates
              </span>
              <span className="text-[11px] font-mono text-amber-400">
                Lat: {customLat.toFixed(4)}°, Lng: {customLng.toFixed(4)}°
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Location Description</label>
                <input
                  type="text"
                  value={customLocation || CORRIDOR_PRESETS[selectedCorridorIndex].location}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={customLat}
                    onChange={(e) => setCustomLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={customLng}
                    onChange={(e) => setCustomLng(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Starting Telemetry State */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Starting Telemetric State Baseline
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setTelemetryPreset('healthy')}
                className={`p-3 rounded-3xl border text-left transition-all ${
                  telemetryPreset === 'healthy'
                    ? 'bg-emerald-500/10 border-emerald-500/60 shadow-sm shadow-emerald-500/10'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Optimal Baseline</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">
                  0 DTCs • 9.4g Soot • 104 PSI cold
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTelemetryPreset('warning')}
                className={`p-3 rounded-3xl border text-left transition-all ${
                  telemetryPreset === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/60 shadow-sm shadow-amber-500/10'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Warning / Soot</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">
                  P2463 DPF Code • 27.5g Soot
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTelemetryPreset('critical')}
                className={`p-3 rounded-3xl border text-left transition-all ${
                  telemetryPreset === 'critical'
                    ? 'bg-rose-500/10 border-rose-500/60 shadow-sm shadow-rose-500/10'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Critical Fault</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">
                  P244B / P2202 • 106°C Coolant
                </p>
              </button>
            </div>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Adding…' : 'Commission & Add Unit to Fleet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
