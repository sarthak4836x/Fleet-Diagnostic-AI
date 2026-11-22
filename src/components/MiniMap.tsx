import React from 'react';
import { FleetVehicle, VehicleStatus } from '../types';
import { GoogleMapsLiveTracking } from './GoogleMapsLiveTracking';

interface MiniMapProps {
  vehicle: FleetVehicle;
  allVehicles?: FleetVehicle[];
  status?: VehicleStatus;
  speedKmh?: number;
  isCompact?: boolean;
  onClose?: () => void;
  className?: string;
  onSelectVehicle?: (vehicleId: string) => void;
  onOpenModal?: () => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  vehicle,
  allVehicles = [],
  status = 'HEALTHY',
  speedKmh,
  isCompact = false,
  className = '',
  onSelectVehicle,
  onOpenModal,
}) => {
  return (
    <GoogleMapsLiveTracking
      vehicle={vehicle}
      allVehicles={allVehicles}
      status={status}
      speedKmh={speedKmh}
      isCompact={isCompact}
      className={className}
      onSelectVehicle={onSelectVehicle}
      onOpenModal={onOpenModal}
    />
  );
};
