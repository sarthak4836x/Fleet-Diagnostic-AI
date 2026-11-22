export interface TirePressureData {
  steer_left_psi: number;
  steer_right_psi: number;
  drive_axle1_left_outer_psi?: number;
  drive_axle1_left_inner_psi?: number;
  drive_axle1_right_inner_psi?: number;
  drive_axle1_right_outer_psi?: number;
  drive_axle2_left_outer_psi?: number;
  drive_axle2_left_inner_psi?: number;
  drive_axle2_right_inner_psi?: number;
  drive_axle2_right_outer_psi?: number;
  drive_avg_psi: number;
  target_psi: number;
}

export interface TelemetryData {
  engine_load_pct: number;
  coolant_temp_c: number;
  battery_voltage_v: number;
  exhaust_temp_c: number;
  nox_sensor_ppm: number;
  active_dtc_codes: string[];
  // DPF Soot Load in grams (0 - 60g)
  soot_level_g: number;
  // Fuel efficiency & dynamics in metric units (KMPH, km/l, L/h)
  speed_kmh: number;
  speed_mph?: number;
  engine_rpm?: number;
  wheel_rpm?: number;
  fuel_rate_lph: number;
  fuel_rate_gph?: number;
  instant_kml: number;
  instant_mpg?: number;
  tire_pressure_psi?: number;
  actual_torque_nm?: number;
  torque_pct?: number;
  torque_derate_pct?: number;
  idle_pct?: number;
  rail_pressure_bar?: number;
  def_level_pct?: number;
}

export interface VehicleSnapshot {
  vehicle_id: string;
  engine_hours: number;
  telemetry: TelemetryData;
}

export type VehicleStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL_STOP';

export type SimCondition = 'hill_climb' | 'cruise' | 'overheat' | 'traffic' | 'route_cycle' | 'dpf_regen';

export interface DiagnosticResult {
  health_score: number;
  status: VehicleStatus;
  primary_diagnosis: string;
  failure_probability_next_24h: number;
  required_parts: string[];
  action_plan: string[];
  estimated_cost_inr?: number;
  timestamp?: string;
  _engine?: string;
}

export interface FuelEfficiencyFactor {
  factor: string;
  impact_kml: number;
  impact_mpg?: number;
  description: string;
  severity: 'MINOR' | 'MODERATE' | 'SEVERE';
}

export interface FuelEfficiencyResult {
  vehicle_id: string;
  current_kml: number;
  baseline_expected_kml: number;
  efficiency_rating: 'OPTIMAL' | 'FAIR' | 'POOR' | 'CRITICAL_WASTE';
  fuel_rate_lph: number;
  idle_fuel_percentage: number;
  potential_causes: FuelEfficiencyFactor[];
  actionable_recommendations: string[];
  estimated_monthly_savings_inr: number;
  // Backward compatibility fields
  current_mpg?: number;
  baseline_expected_mpg?: number;
  fuel_rate_gph?: number;
  estimated_monthly_savings_usd?: number;
  timestamp?: string;
  _engine?: string;
}

export interface HistoricalRecord {
  date: string;
  engine_hours: number;
  avg_kml: number;
  avg_mpg?: number;
  coolant_temp_peak_c: number;
  voltage_min_v: number;
  dtc_logged: string[];
  notes: string;
}

export interface RecurringIssue {
  issue_name: string;
  frequency_last_90d: number;
  root_cause_trend: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface PredictedMaintenanceNeed {
  component: string;
  predicted_failure_window: string;
  confidence_pct: number;
  recommended_action: string;
  estimated_cost_inr?: number;
}

export interface ScheduleAdjustment {
  task: string;
  current_interval: string;
  recommended_interval: string;
  reasoning: string;
}

export interface PredictiveMaintenanceResult {
  vehicle_id: string;
  recurring_issues: RecurringIssue[];
  common_failure_patterns: string[];
  predicted_maintenance_needs: PredictedMaintenanceNeed[];
  recommended_schedule_adjustments: ScheduleAdjustment[];
  estimated_downtime_cost_inr?: number;
  timestamp?: string;
  _engine?: string;
}

export interface VehicleCoordinates {
  lat: number;
  lng: number;
  heading?: number;
  altitude_m?: number;
  landmark?: string;
  route_corridor?: string;
  state?: string;
}

export interface FleetVehicle {
  vehicle_id: string;
  unit_name: string;
  make_model: string;
  year: number;
  vin: string;
  driver: string;
  driver_name?: string;
  location: string;
  state?: string;
  coordinates: VehicleCoordinates;
  engine_hours: number;
  telemetry: TelemetryData;
  payload?: string;
  gvw_tons?: number;
  load_type?: string;
  status?: 'NORMAL' | 'WARNING' | 'CRITICAL' | VehicleStatus;
  history?: HistoricalRecord[];
  notes?: string;
}

export interface DtcDefinition {
  code: string;
  title: string;
  component: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  spn_fmi?: string;
  description: string;
  common_symptoms: string[];
  milStatus?: string;
  effectOnVehicle?: string;
  checkpoints?: string[];
  steps?: { step: number; action: string; spec?: string }[];
  schematicNote?: string;
}

export interface SensorDefinition {
  id: string;
  name: string;
  code_spn: string;
  category: 'Powertrain' | 'Aftertreatment & Emissions' | 'Electrical & Dynamics' | 'Fuel System';
  unit: string;
  currentValue?: number | string;
  nominalRange: string;
  warningRange: string;
  criticalRange: string;
  meaning: string;
  failureImpact: string;
}

export type UserRole = 'developer' | 'fleet_director' | 'fleet_manager' | 'technician' | 'dispatcher';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  badgeNumber: string;
  avatarColor: string;
  shift?: string;
  depot?: string;
  permissions?: string[];
  /** False until the account has set its own three security questions. */
  hasSecurityQuestions?: boolean;
  /** The fleet this account works in. For a developer, the active fleet. */
  fleetId?: string;
  fleetName?: string;
  isDemoFleet?: boolean;
}

export interface SignupAccessRequest {
  id: string;
  fullName: string;
  email: string;
  requestedRole: UserRole;
  fleetCode: string;
  depotLocation?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type ServiceCategory =
  | 'Engine & Lube'
  | 'Aftertreatment & DPF'
  | 'Braking & Chassis'
  | 'Cooling & Electrical'
  | 'Fuel System'
  | 'Custom Part';

export interface ServiceTaskItem {
  id: string;
  task: string;
  // Custom tasks take free text from the estimator's category input; `string & {}` keeps the known names suggested.
  category: ServiceCategory | (string & {});
  standardIntervalKm: number;
  estimatedLaborHours: number;
  partsCostInr: number;
  recommendedDue?: boolean;
  priority: 'Routine' | 'Recommended' | 'Urgent';
  description: string;
}

export type VehicleLoadPreset = 'unladen' | 'half' | 'rated' | 'overload' | 'custom';

export interface VehicleLoadConfig {
  preset: VehicleLoadPreset;
  grossVehicleWeightKg: number;
  tareWeightKg: number;
  payloadKg: number;
  maxRatedGvwKg: number;
  steerAxleWeightKg: number;
  driveAxleWeightKg: number;
  trailerAxleWeightKg: number;
  suspensionBellowsPressureBar: number;
  brakeDistanceFactor: number;
  engineLoadOffsetPct: number;
  fuelPenaltyPct: number;
}


export interface Fleet {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  isDemo: boolean;
  createdAt: string;
}
