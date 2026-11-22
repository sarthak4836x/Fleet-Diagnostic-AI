import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { TelemetryAlert } from '../hooks/useTelemetryAlerts';

interface TelemetryAlertBannerProps {
  alerts: TelemetryAlert[];
  onDismiss?: (id: string) => void;
}

export const TelemetryAlertBanner: React.FC<TelemetryAlertBannerProps> = ({ alerts, onDismiss }) => {
  if (!alerts || alerts.length === 0) return null;

  // Render only the highest priority alert for the banner to avoid screen clutter
  const criticalAlerts = alerts.filter(a => a.type === 'critical');
  const displayAlert = criticalAlerts.length > 0 ? criticalAlerts[0] : alerts[0];
  const isCritical = displayAlert.type === 'critical';

  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-2 sm:px-4 pointer-events-none flex justify-center mt-4">
      <div 
        className={`pointer-events-auto max-w-2xl w-full mx-auto rounded-2xl border backdrop-blur-md shadow-2xl overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 ${
          isCritical 
            ? 'bg-rose-500/90 border-rose-400 text-white shadow-[0_8px_32px_rgba(225,29,72,0.4)]' 
            : 'bg-amber-500/90 border-amber-400 text-white shadow-[0_8px_32px_rgba(217,119,6,0.3)]'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3 p-3 sm:p-4">
          <div className={`shrink-0 p-2 rounded-xl ${isCritical ? 'bg-rose-600/50' : 'bg-amber-600/50'}`}>
            {isCritical ? (
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          
          <div className="flex-1 min-w-0 pt-0.5 sm:pt-0">
            <h4 className="font-bold font-display uppercase tracking-wider text-sm sm:text-base leading-tight">
              {displayAlert.title}
              {alerts.length > 1 && (
                <span className="ml-2 text-[10px] sm:text-xs font-mono bg-black/20 px-2 py-0.5 rounded-full">
                  +{alerts.length - 1} MORE
                </span>
              )}
            </h4>
            <p className="text-xs sm:text-sm text-white/90 font-mono mt-0.5 line-clamp-2">
              {displayAlert.message}
            </p>
          </div>
          <button 
            onClick={() => onDismiss?.(displayAlert.id)}
            className="p-1 sm:p-1.5 -mr-1 sm:-mr-2 rounded-xl hover:bg-black/20 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
