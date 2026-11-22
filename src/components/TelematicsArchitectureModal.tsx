import React, { useEffect } from 'react';
import { X, Layers } from 'lucide-react';
import { TelematicsArchitecture } from './TelematicsArchitecture';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface TelematicsArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSimulating?: boolean;
  onToggleSimulation?: () => void;
}

export const TelematicsArchitectureModal: React.FC<TelematicsArchitectureModalProps> = ({
  isOpen,
  onClose,
  isSimulating,
  onToggleSimulation,
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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-black border border-slate-800 rounded-3xl shadow-2xl overflow-y-auto">
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-xl-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          title="Close Architecture Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Embedded Architecture Flow */}
        <TelematicsArchitecture
          onBack={onClose}
          isStandalonePage={true}
          isSimulating={isSimulating}
          onToggleSimulation={onToggleSimulation}
        />
      </div>
    </div>
  );
};
