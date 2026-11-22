import React, { useState, useEffect } from 'react';
import { X, Search, Activity, AlertTriangle, ShieldCheck, AlertOctagon, Gauge, Info, Filter } from 'lucide-react';
import { COMPREHENSIVE_SENSOR_DEFINITIONS } from '../data/sensorDefinitions';
import { TelemetryData } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface SensorDefinitionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry?: TelemetryData;
}

export const SensorDefinitionsModal: React.FC<SensorDefinitionsModalProps> = ({
  isOpen,
  onClose,
  telemetry,
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
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const categories = ['ALL', 'Aftertreatment & Emissions', 'Powertrain', 'Electrical & Dynamics', 'Fuel System'];

  const filteredSensors = COMPREHENSIVE_SENSOR_DEFINITIONS.filter((sensor) => {
    const matchesCategory = selectedCategory === 'ALL' || sensor.category === selectedCategory;
    const matchesQuery =
      sensor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sensor.code_spn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sensor.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sensor.unit.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const getCurrentSensorValue = (sensorId: string): { display: string; status: 'nominal' | 'warning' | 'critical' } | null => {
    if (!telemetry) return null;

    switch (sensorId) {
      case 'soot_level_g': {
        const val = telemetry.soot_level_g ?? 24.5;
        const status = val >= 28 ? 'critical' : val >= 18 ? 'warning' : 'nominal';
        return { display: `${val.toFixed(1)} g`, status };
      }
      case 'coolant_temp_c': {
        const val = telemetry.coolant_temp_c;
        const status = val >= 105 ? 'critical' : val >= 96 ? 'warning' : 'nominal';
        return { display: `${val} °C`, status };
      }
      case 'battery_voltage_v': {
        const val = telemetry.battery_voltage_v;
        const status = val < 23.5 ? 'critical' : val < 26.5 ? 'warning' : 'nominal';
        return { display: `${val.toFixed(1)} V`, status };
      }
      case 'nox_sensor_ppm': {
        const val = telemetry.nox_sensor_ppm;
        const status = val >= 1000 ? 'critical' : val >= 350 ? 'warning' : 'nominal';
        return { display: `${val} PPM`, status };
      }
      case 'exhaust_temp_c': {
        const val = telemetry.exhaust_temp_c;
        const status = val >= 620 ? 'critical' : val >= 481 ? 'warning' : 'nominal';
        return { display: `${val} °C`, status };
      }
      case 'speed_kmh': {
        const val = telemetry.speed_kmh ?? Math.round((telemetry.speed_mph ?? 58) * 1.60934);
        const status = val > 90 ? 'critical' : val > 80 ? 'warning' : 'nominal';
        return { display: `${val} KMPH`, status };
      }
      case 'instant_kml': {
        const val = telemetry.instant_kml ?? Number(((telemetry.instant_mpg ?? 5.18) * 0.425144).toFixed(2));
        const status = val < 3.5 ? 'critical' : val < 4.8 ? 'warning' : 'nominal';
        return { display: `${val} km/l`, status };
      }
      case 'fuel_rate_lph': {
        const val = telemetry.fuel_rate_lph ?? Number(((telemetry.fuel_rate_gph ?? 11.2) * 3.78541).toFixed(1));
        const status = val > 48 ? 'critical' : val > 35 ? 'warning' : 'nominal';
        return { display: `${val} L/h`, status };
      }
      case 'tire_pressure_psi': {
        const val = telemetry.tire_pressure_psi ?? 84;
        const status = val < 90 ? 'critical' : val < 105 ? 'warning' : 'nominal';
        return { display: `${val} PSI`, status };
      }
      case 'engine_load_pct': {
        const val = telemetry.engine_load_pct;
        const status = val >= 85 ? 'critical' : val >= 66 ? 'warning' : 'nominal';
        return { display: `${val}%`, status };
      }
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col text-slate-100 p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-3xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 font-display">
                  Commercial Vehicle Sensor Specifications & Value Definitions
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  BSVI / SAE J1939 Standard
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Nominal, Warning, and Critical thresholds across powertrain, emissions, soot, and dynamics
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

        {/* Filter and Search Bar */}
        <div className="space-y-3 mb-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search sensors by name, SPN code, unit, or meaning..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 text-xs font-mono">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-2xl transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-400 text-slate-950 font-bold shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Sensor Definitions List */}
        <div className="space-y-4 overflow-y-auto pr-1">
          {filteredSensors.map((sensor) => {
            const liveReading = getCurrentSensorValue(sensor.id);

            return (
              <div
                key={sensor.id}
                className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 hover:border-slate-700 transition-all space-y-3"
              >
                {/* Header of card */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-100 font-display">
                        {sensor.name}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-slate-800 text-amber-300 border border-slate-700 font-semibold">
                        {sensor.code_spn}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800">
                        {sensor.category}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1">
                      Standard Unit: <strong className="text-slate-200">{sensor.unit}</strong>
                    </div>
                  </div>

                  {/* Live Vehicle Value Pill */}
                  {liveReading && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] uppercase font-mono text-slate-400">Current Unit Reading:</span>
                      <span
                        className={`text-xs font-mono font-black ${
                          liveReading.status === 'critical'
                            ? 'text-rose-400'
                            : liveReading.status === 'warning'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {liveReading.display}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-xl-full ${
                          liveReading.status === 'critical'
                            ? 'bg-rose-500 animate-ping'
                            : liveReading.status === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                      ></span>
                    </div>
                  )}
                </div>

                {/* Threshold Band Definitions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
                  {/* Nominal Range */}
                  <div className="p-2.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-1 text-emerald-400 font-bold mb-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Nominal Range</span>
                    </div>
                    <p className="text-slate-300 font-medium">{sensor.nominalRange}</p>
                  </div>

                  {/* Warning Range */}
                  <div className="p-2.5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-1 text-amber-400 font-bold mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Warning Range</span>
                    </div>
                    <p className="text-slate-300 font-medium">{sensor.warningRange}</p>
                  </div>

                  {/* Critical Range */}
                  <div className="p-2.5 rounded-2xl bg-rose-500/5 border border-rose-500/20">
                    <div className="flex items-center gap-1 text-rose-400 font-bold mb-1">
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <span>Critical Range</span>
                    </div>
                    <p className="text-slate-300 font-medium">{sensor.criticalRange}</p>
                  </div>
                </div>

                {/* Meaning & Failure Impact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                  <div>
                    <span className="font-mono font-bold text-slate-400 uppercase text-[10px] block mb-0.5">
                      Sensor Purpose & Operation:
                    </span>
                    <p className="text-slate-300 leading-relaxed font-sans">{sensor.meaning}</p>
                  </div>
                  <div>
                    <span className="font-mono font-bold text-rose-400 uppercase text-[10px] block mb-0.5">
                      Deviation & Failure Consequence:
                    </span>
                    <p className="text-slate-300 leading-relaxed font-sans">{sensor.failureImpact}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredSensors.length === 0 && (
            <div className="text-center py-10 text-slate-400 font-mono text-xs">
              No sensors match the query &quot;{searchQuery}&quot;.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs font-mono text-slate-400">
          <span>Total Defined Telemetric Sensors: {COMPREHENSIVE_SENSOR_DEFINITIONS.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
