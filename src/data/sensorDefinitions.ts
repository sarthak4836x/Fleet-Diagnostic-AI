import { SensorDefinition } from '../types';

export const COMPREHENSIVE_SENSOR_DEFINITIONS: SensorDefinition[] = [
  {
    id: 'soot_level_g',
    name: 'DPF Soot Mass Accumulation',
    code_spn: 'SPN 3719 / J1939',
    category: 'Aftertreatment & Emissions',
    unit: 'g (grams)',
    nominalRange: '< 18.0 g (Passive exhaust oxidation active)',
    warningRange: '18.0 - 28.0 g (Active highway regeneration recommended)',
    criticalRange: '> 28.0 g (Stationary park regen required; >40.0 g triggers 25% torque derate)',
    meaning:
      'Quantifies accumulated solid particulate carbon soot trapped inside the cordierite/silicon-carbide wall-flow Diesel Particulate Filter core.',
    failureImpact:
      'Extreme exhaust backpressure, turbocharger thrust bearing wear, elevated pyrometer temperatures, and ECU-commanded torque derate and creep inducement mode.',
  },
  {
    id: 'coolant_temp_c',
    name: 'Engine Coolant Temperature (ECT)',
    code_spn: 'SPN 110 / ECT 1',
    category: 'Powertrain',
    unit: '°C',
    nominalRange: '82°C - 95°C (Thermostat regulated operating band)',
    warningRange: '96°C - 104°C (Thermal load threshold, fan clutch active)',
    criticalRange: '≥ 105°C (Imminent boilover, cylinder liner scuffing, head gasket failure)',
    meaning:
      'Monitors the thermal equilibrium of the engine closed-loop water jacket cooling circuit.',
    failureImpact:
      'Overheating leads to cylinder head warpage, piston crown scuffing, oil viscosity degradation, and cracked exhaust valve seats.',
  },
  {
    id: 'battery_voltage_v',
    name: '24V Electrical Bus / Alternator Output',
    code_spn: 'SPN 168 / Electrical Bus',
    category: 'Electrical & Dynamics',
    unit: 'V (Volts)',
    nominalRange: '26.8V - 28.4V (Dual-battery alternator charging float)',
    warningRange: '24.0V - 26.5V (Alternator diode ripple or heavy accessory draw)',
    criticalRange: '< 23.5V (Battery collapse; common rail piezo injectors fail to actuate)',
    meaning:
      'Tracks direct current potential across the dual 12V series-connected 24V commercial vehicle electrical harness.',
    failureImpact:
      'Low voltage impairs solenoid valve switching in Common Rail and DEF dosing valves, induces CAN bus communication dropping, and causes ECU reboot.',
  },
  {
    id: 'nox_sensor_ppm',
    name: 'NOx Concentration Sensor (Bank 1 Sensor 1)',
    code_spn: 'SPN 3216 / Upstream NOx',
    category: 'Aftertreatment & Emissions',
    unit: 'PPM (Parts Per Million)',
    nominalRange: '< 150 PPM (Clean post-DOC exhaust stream)',
    warningRange: '150 - 500 PPM (SCR conversion degradation, crystalized injector)',
    criticalRange: '≥ 1000 PPM (BSVI / EPA compliance breach; triggers 50h derate timer)',
    meaning:
      'High-temperature ceramic electrochemical sensor measuring nitrogen oxide gases entering the selective catalytic reduction (SCR) chamber.',
    failureImpact:
      'BSVI legal emission limits breached, causing ECU to command permanent torque derate down to 20 km/h creep mode until DEF dosing fault is rectified.',
  },
  {
    id: 'exhaust_temp_c',
    name: 'Exhaust Gas Temperature (EGT Pyrometer)',
    code_spn: 'SPN 173 / Post-Turbo EGT',
    category: 'Powertrain',
    unit: '°C',
    nominalRange: '320°C - 480°C (Typical highway loaded cruising)',
    warningRange: '481°C - 619°C (Elevated gradient climb or active DPF burner phase)',
    criticalRange: '≥ 620°C (Thermal runaway risk, manifold cracking, turbo wheel failure)',
    meaning:
      'Measures thermal energy exiting the exhaust manifold ahead of the diesel oxidation catalyst (DOC).',
    failureImpact:
      'Excess heat destroys turbocharger turbine blades, cooks exhaust valves, and can sinter ceramic catalyst washcoats.',
  },
  {
    id: 'speed_kmh',
    name: 'Road Speed (Vehicle Velocity)',
    code_spn: 'SPN 84 / Wheel Speed',
    category: 'Electrical & Dynamics',
    unit: 'KMPH (km/h)',
    nominalRange: '0 - 80 KMPH (Indian standard highway commercial vehicle speed governor limit)',
    warningRange: '81 - 90 KMPH (Approaching safety governor limit)',
    criticalRange: '> 90 KMPH (Overspeed violation on Indian freight corridors)',
    meaning:
      'Calculated vehicle velocity from transmission output shaft tone ring and ABS wheel speed sensors.',
    failureImpact:
      'Overspeed increases aerodynamic drag exponentially, skyrockets brake thermal fatigue, and reduces tire life.',
  },
  {
    id: 'instant_kml',
    name: 'Instantaneous Fuel Economy',
    code_spn: 'SPN 184 / Instantaneous km/l',
    category: 'Fuel System',
    unit: 'km/l (Kilometers per Litre)',
    nominalRange: '4.8 - 6.5 km/l (Optimal laden long-haul heavy commercial freight)',
    warningRange: '3.6 - 4.7 km/l (Sub-optimal, hilly terrain or moderate cargo load)',
    criticalRange: '< 3.5 km/l (Severe fuel wastage; check brake drag, air filter, injector leak)',
    meaning:
      'Real-time ratio of vehicle distance traveled to fuel consumed calculated by engine ECU injector pulse-width telemetry.',
    failureImpact:
      'Each 1.0 km/l drop on a 15,000 km monthly route adds ₹75,000 - ₹1,10,000 to monthly diesel expenditures.',
  },
  {
    id: 'fuel_rate_lph',
    name: 'Fuel Consumption Rate',
    code_spn: 'SPN 183 / Fuel Flow',
    category: 'Fuel System',
    unit: 'L/h (Litres per Hour)',
    nominalRange: '18 - 35 L/h (Steady cruising at 60 - 75 KMPH)',
    warningRange: '36 - 48 L/h (Heavy gradient or hard acceleration)',
    criticalRange: '> 48 L/h (Excessive consumption; possible over-fueling or black smoke)',
    meaning:
      'Instant volumetric flow rate of diesel fuel delivered from high pressure common rail pump to cylinders.',
    failureImpact:
      'Uncalibrated fuel delivery produces unburnt soot, clogging the DPF rapidly and raising fuel bills.',
  },
  {
    id: 'tire_pressure_psi',
    name: 'Tire Inflation Pressure (Steer & Drive)',
    code_spn: 'SPN 241 / TPMS',
    category: 'Electrical & Dynamics',
    unit: 'PSI',
    nominalRange: '105 - 115 PSI (Cold specification for heavy commercial radials)',
    warningRange: '90 - 104 PSI (Underinflated, increases rolling resistance by ~0.4 km/l)',
    criticalRange: '< 90 PSI (High risk of zipper rupture, casing blowout, and tread separation)',
    meaning:
      'Pneumatic pressure inside heavy commercial multi-ply radial truck tires.',
    failureImpact:
      'Underinflation generates excessive carcass heat, decreases fuel economy by 6-10%, and causes catastrophic highway tire blowouts.',
  },
  {
    id: 'engine_load_pct',
    name: 'Calculated Engine Load / Torque Demand',
    code_spn: 'SPN 92 / Engine Load',
    category: 'Powertrain',
    unit: '%',
    nominalRange: '25% - 65% (Cruising highway payload)',
    warningRange: '66% - 84% (Rolling hills, moderate acceleration)',
    criticalRange: '≥ 85% (Continuous maximum torque demand on steep ghats / mountain grades)',
    meaning:
      'Percentage of available engine peak torque currently commanded by driver throttle and drivetrain resistance.',
    failureImpact:
      'Continuous 100% load generates peak thermal stresses on connecting rod bearings, turbocharger, and cooling system.',
  },
];
