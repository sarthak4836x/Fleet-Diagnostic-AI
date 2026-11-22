import React from 'react';
import { LogOut, Plus, RefreshCw, Truck } from 'lucide-react';
import type { FleetLoadFailure } from '../services/fleetApi';

interface EmptyFleetStateProps {
  state: 'loading' | 'empty' | 'error';
  onAddVehicle: () => void;
  onRetry: () => void;
  onSignOut: () => void;
  failure?: FleetLoadFailure;
}

export const EmptyFleetState: React.FC<EmptyFleetStateProps> = ({ state, onAddVehicle, onRetry, onSignOut, failure }) => {
  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400" role="status" aria-busy="true">
        <span className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading your fleet</p>
      </div>
    );
  }

  const isError = state === 'error';
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center" role={isError ? 'alert' : undefined}>
      <Truck className="w-10 h-10 text-slate-500" aria-hidden="true" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-white">
          {isError ? 'Could not load your fleet' : 'No vehicles yet'}
        </h1>
        <p className="text-sm text-slate-400 max-w-sm">
          {isError
            ? failure?.message || 'Your vehicles could not be loaded right now. Check your connection and try again.'
            : 'Add your first vehicle to start monitoring its health, fuel use and service needs.'}
        </p>
      </div>
      {isError && (failure?.canRetry ?? true) && (
        <button type="button" onClick={onRetry} className="apple-button-primary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      )}
      {isError && failure?.needsSignOut && (
        <button type="button" onClick={onSignOut} className="apple-button-primary inline-flex items-center gap-2">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      )}
      {!isError && (
        <button type="button" onClick={onAddVehicle} className="apple-button-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add vehicle
        </button>
      )}
    </div>
  );
};
