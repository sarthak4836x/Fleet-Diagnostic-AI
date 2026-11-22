import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textClassName?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  textClassName = '',
}) => {
  const rawId = useId();
  // Sanitize id for SVG element references
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Precision Vector Emblem */}
      <div
        className={`relative ${sizeMap[size]} shrink-0 transition-transform duration-200 hover:scale-105`}
        title="FleetDiag AI - Commercial Heavy-Duty Telematics & Diagnostics"
      >
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_10px_rgba(6,182,212,0.3)]"
        >
          <defs>
            <linearGradient id={`bgGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="50%" stopColor="#090d16" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            <linearGradient id={`shieldBorder_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="45%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>

            <linearGradient id={`truckGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>

            <linearGradient id={`amberPulse_${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>

            <filter id={`glow_${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Hexagonal Shield Outer Contour - Perfectly Centered at x=60 */}
          <polygon
            points="60,10 104,28 104,76 60,110 16,76 16,28"
            fill={`url(#bgGrad_${uid})`}
            stroke={`url(#shieldBorder_${uid})`}
            strokeWidth="3.2"
            strokeLinejoin="round"
          />

          {/* Inset Precision Boundary Line */}
          <polygon
            points="60,18 96,33 96,72 60,102 24,72 24,33"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1"
            strokeOpacity="0.3"
            strokeDasharray="2 2"
          />

          {/* Aerodynamic Roof Fairing & Air Deflector */}
          <polygon
            points="46,31 74,31 82,41 38,41"
            fill={`url(#truckGrad_${uid})`}
            opacity="0.95"
          />

          {/* Dual Windshield with Center Divider */}
          <polygon
            points="41,44 79,44 82,55 38,55"
            fill="#082f49"
            stroke="#38bdf8"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <line x1="60" y1="44" x2="60" y2="55" stroke="#38bdf8" strokeWidth="1.2" />

          {/* Heavy-Duty Radiator Grille & Cab Body */}
          <rect
            x="36"
            y="57"
            width="48"
            height="18"
            rx="2"
            fill="#0c4a6e"
            stroke="#0284c7"
            strokeWidth="1.2"
          />

          {/* Precision Grille Slats */}
          <line x1="42" y1="61" x2="78" y2="61" stroke="#e0f2fe" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
          <line x1="44" y1="65" x2="76" y2="65" stroke="#bae6fd" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
          <line x1="46" y1="69" x2="74" y2="69" stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />

          {/* LED Headlights (Left & Right) */}
          <rect x="37" y="60" width="3" height="9" rx="1" fill="#fde047" />
          <rect x="80" y="60" width="3" height="9" rx="1" fill="#fde047" />

          {/* Heavy Commercial Wheels */}
          <circle cx="37" cy="76" r="6" fill="#020617" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="37" cy="76" r="2" fill="#f59e0b" />

          <circle cx="83" cy="76" r="6" fill="#020617" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="83" cy="76" r="2" fill="#f59e0b" />

          {/* Real-time CAN-Bus Telemetry Pulse Wave - Fully contained within shield */}
          <path
            d="M26,87 L40,87 L46,80 L52,94 L58,81 L64,91 L70,87 L94,87"
            fill="none"
            stroke={`url(#amberPulse_${uid})`}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#glow_${uid})`}
          />

          {/* Diagnostic Spark Node */}
          <circle cx="58" cy="81" r="2.2" fill="#fbbf24" filter={`url(#glow_${uid})`} />
          <circle cx="86" cy="27" r="2" fill="#38bdf8" filter={`url(#glow_${uid})`} />
          <circle cx="76" cy="21" r="1.5" fill="#22d3ee" />
          <line x1="76" y1="21" x2="86" y2="27" stroke="#38bdf8" strokeWidth="1" strokeDasharray="1.5 1.5" opacity="0.7" />
        </svg>
      </div>

      {showText && (
        <div className={`flex flex-col ${textClassName}`}>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-extrabold text-base tracking-tight text-white font-sans">FleetDiag</span>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 tracking-wider uppercase font-mono">
              AI
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">Heavy-Duty Telematics</span>
        </div>
      )}
    </div>
  );
};
