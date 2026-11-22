import { useState, useEffect } from 'react';
import { TelemetryData } from '../types';

export interface TelemetryAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
}

/** Made-up notifications for trying the bell in a demo fleet. They describe no real person or vehicle. */
const SAMPLE_ALERTS: TelemetryAlert[] = [
  {
    id: 'sys_registration',
    type: 'info',
    title: 'NEW REGISTRATION REQUEST',
    message: 'Employee "Sarthak Gohil" requested access to FleetDiag.',
  },
  {
    id: 'sys_breakdown',
    type: 'critical',
    title: 'VEHICLE BREAKDOWN REPORTED',
    message: 'Unit TATA-PRIMA-9099 reported a roadside breakdown on NH-48.',
  },
];

export function buildTelemetryAlerts(telemetry: TelemetryData, includeSamples: boolean): TelemetryAlert[] {
  const newAlerts: TelemetryAlert[] = includeSamples ? [...SAMPLE_ALERTS] : [];

  // Coolant Temperature
  const coolantTemp = telemetry.coolant_temp_c ?? 90;
  if (coolantTemp >= 105) {
    newAlerts.push({
      id: 'coolant_critical',
      type: 'critical',
      title: 'OVERHEAT CRITICAL',
      message: `Coolant temp reached ${coolantTemp}°C. Immediate engine derate advised to prevent thermal damage.`,
    });
  } else if (coolantTemp >= 98) {
    newAlerts.push({
      id: 'coolant_warning',
      type: 'warning',
      title: 'ELEVATED TEMPERATURE',
      message: `Coolant temp is ${coolantTemp}°C. Monitor cooling system.`,
    });
  }

  // Battery Voltage
  const voltage = telemetry.battery_voltage_v ?? 28.2;
  if (voltage < 23.5) {
    newAlerts.push({
      id: 'voltage_critical_low',
      type: 'critical',
      title: 'BUS COLLAPSE RISK',
      message: `System voltage dropped to ${voltage.toFixed(1)}V. Alternator failure imminent.`,
    });
  } else if (voltage < 25.5) {
    newAlerts.push({
      id: 'voltage_warning_low',
      type: 'warning',
      title: 'LOW ALTERNATOR OUTPUT',
      message: `Voltage at ${voltage.toFixed(1)}V. Check charging system.`,
    });
  } else if (voltage > 30.0) {
    newAlerts.push({
      id: 'voltage_warning_high',
      type: 'warning',
      title: 'SYSTEM OVERVOLTAGE',
      message: `Voltage spiking at ${voltage.toFixed(1)}V. Regulator may be failing.`,
    });
  }

  // Engine RPM
  const rpm = telemetry.engine_rpm ?? 1450;
  if (rpm > 2100) {
    newAlerts.push({
      id: 'rpm_critical',
      type: 'critical',
      title: 'ENGINE OVERSPEED',
      message: `RPM at ${rpm}. Mechanical stress critical. Reduce speed immediately.`,
    });
  }

  // DPF Soot
  const soot = telemetry.soot_level_g ?? 24.5;
  if (soot >= 40.0) {
    newAlerts.push({
      id: 'soot_critical',
      type: 'critical',
      title: 'DPF FILTER CLOGGED',
      message: `Soot accumulation at ${soot.toFixed(1)}g. Forced engine derate (20 km/h) active.`,
    });
  } else if (soot >= 28.0) {
    newAlerts.push({
      id: 'soot_warning_high',
      type: 'warning',
      title: 'PARKED REGEN REQUIRED',
      message: `Soot accumulation at ${soot.toFixed(1)}g. Filter saturation high.`,
    });
  }

  // Exhaust Temp
  const exhaust = telemetry.exhaust_temp_c ?? 320;
  if (exhaust >= 620) {
    newAlerts.push({
      id: 'exhaust_critical',
      type: 'critical',
      title: 'THERMAL RUNAWAY RISK',
      message: `EGT at ${exhaust}°C. Extreme risk to aftertreatment system.`,
    });
  }

  // NOx Emissions
  const nox = telemetry.nox_sensor_ppm ?? 150;
  if (nox >= 1000) {
    newAlerts.push({
      id: 'nox_critical',
      type: 'critical',
      title: 'BSVI EMISSIONS VIOLATION',
      message: `NOx levels critically high (${nox} ppm). SCR failure suspected.`,
    });
  }

  return newAlerts;
}

export const useTelemetryAlerts = (telemetry: TelemetryData | undefined, includeSamples = false) => {
  const [alerts, setAlerts] = useState<TelemetryAlert[]>([]);

  useEffect(() => {
    setAlerts(telemetry ? buildTelemetryAlerts(telemetry, includeSamples) : []);
  }, [telemetry, includeSamples]);

  return alerts;
};
