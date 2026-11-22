import { FleetVehicle, DtcDefinition, VehicleSnapshot, DiagnosticResult, FuelEfficiencyResult, PredictiveMaintenanceResult } from '../types';
import { TATA_MOTORS_BSVI_DTC_LIST } from './tataMotorsDtcData';

export const INITIAL_MOCK_SNAPSHOT: VehicleSnapshot = {
  vehicle_id: "TATA-PRIMA-5530",
  engine_hours: 8420,
  telemetry: {
    engine_load_pct: 86,
    coolant_temp_c: 104,
    battery_voltage_v: 24.2,
    exhaust_temp_c: 585,
    nox_sensor_ppm: 890,
    active_dtc_codes: ["P2202", "P0118"],
    soot_level_g: 28.4,
    speed_kmh: 52,
    speed_mph: 32,
    engine_rpm: 1450,
    fuel_rate_lph: 41.5,
    fuel_rate_gph: 10.9,
    instant_kml: 3.82,
    instant_mpg: 5.14,
    tire_pressure_psi: 108,
    idle_pct: 18,
    rail_pressure_bar: 1450,
    def_level_pct: 42,
  }
};

export const FLEET_PRESETS: FleetVehicle[] = [
  {
    vehicle_id: "TATA-PRIMA-5530",
    unit_name: "Prima 5530.S Trans-Himalayan Heavy Tractor",
    make_model: "Tata Prima 5530.S (Cummins ISBe 6.7L BSVI 300HP)",
    year: 2023,
    vin: "MAT416553P1A55301",
    driver: "Tariq Ahmad Bhat",
    driver_name: "Tariq Ahmad Bhat",
    state: "Jammu & Kashmir",
    location: "NH-44 Trans-Himalayan Highway, Banihal-Qazigund Tunnel South Portal, J&K",
    coordinates: {
      lat: 33.5186,
      lng: 75.1950,
      heading: 345,
      altitude_m: 1790,
      landmark: "Navyug Banihal-Qazigund Twin-Tube Tunnel (Pir Panjal Pass)",
      route_corridor: "NH-44 Jammu-Srinagar Himalayan Strategic Highway (J&K)",
      state: "Jammu & Kashmir",
    },
    engine_hours: 8420,
    payload: "38.5 Ton Heavy High-Altitude Cold-Chain Kashmiri Apples & Strategic Cargo",
    gvw_tons: 55.0,
    load_type: "Cold-Chain Mountain Logistics & Freight",
    status: "WARNING",
    telemetry: {
      engine_load_pct: 86,
      coolant_temp_c: 104,
      battery_voltage_v: 24.2,
      exhaust_temp_c: 585,
      nox_sensor_ppm: 890,
      active_dtc_codes: ["P2202", "P0118"],
      soot_level_g: 28.4,
      speed_kmh: 52,
      speed_mph: 32,
      engine_rpm: 1450,
      fuel_rate_lph: 41.5,
      fuel_rate_gph: 10.9,
      instant_kml: 3.82,
      instant_mpg: 5.14,
      tire_pressure_psi: 108,
      idle_pct: 18,
      rail_pressure_bar: 1450,
      def_level_pct: 42,
    },
    notes: "High-altitude mountain haul on 6.5% incline ascending Banihal pass in J&K. Coolant temp elevated to 104°C and upstream NOx circuit warning logged under thin air mountain duty.",
    history: [
      {
        date: "2026-09-12",
        engine_hours: 8350,
        avg_kml: 3.90,
        avg_mpg: 5.3,
        coolant_temp_peak_c: 102,
        voltage_min_v: 24.1,
        dtc_logged: ["P2202"],
        notes: "NOx sensor error logged during stop-and-go mountain pass crawl. Cleared after wiring inspection."
      },
      {
        date: "2026-08-25",
        engine_hours: 8100,
        avg_kml: 4.15,
        avg_mpg: 5.6,
        coolant_temp_peak_c: 98,
        voltage_min_v: 24.6,
        dtc_logged: ["P0118"],
        notes: "ECT sensor harness cleaned at Tata Commercial Dealership Srinagar. Coolant flushed with anti-freeze formulation."
      },
      {
        date: "2026-08-05",
        engine_hours: 7750,
        avg_kml: 4.30,
        avg_mpg: 5.8,
        coolant_temp_peak_c: 94,
        voltage_min_v: 25.2,
        dtc_logged: [],
        notes: "Scheduled Tata Motors high-altitude PM service in Jammu. Engine oil, oil filter, and fuel water separator replaced."
      }
    ]
  },
  {
    vehicle_id: "TATA-ULTRA-T16",
    unit_name: "Ultra T.16 Sleek Grand Trunk Express",
    make_model: "Tata Ultra T.16 Sleek BSVI (3.3L Turbotronn NG 160HP)",
    year: 2024,
    vin: "MAT417016P2A16044",
    driver: "Gurpreet Singh Dhillon",
    driver_name: "Gurpreet Singh Dhillon",
    state: "Punjab",
    location: "NH-44 GT Road (Grand Trunk), Shambhu Border Toll Barrier, Rajpura, Punjab",
    coordinates: {
      lat: 30.4350,
      lng: 76.7120,
      heading: 315,
      altitude_m: 278,
      landmark: "Shambhu Inter-State Commercial Barrier & Markfed Grain Terminal",
      route_corridor: "NH-44 Grand Trunk Express Arterial (Punjab Corridor)",
      state: "Punjab",
    },
    engine_hours: 3200,
    payload: "11.2 Ton Food Corporation of India (FCI) Wheat Flour & Basmati Rice Sacks",
    gvw_tons: 16.1,
    load_type: "Agricultural Food Grains & FMCG",
    status: "NORMAL",
    telemetry: {
      engine_load_pct: 46,
      coolant_temp_c: 86,
      battery_voltage_v: 27.8,
      exhaust_temp_c: 320,
      nox_sensor_ppm: 48,
      active_dtc_codes: [],
      soot_level_g: 9.6,
      speed_kmh: 78,
      speed_mph: 48,
      fuel_rate_lph: 24.5,
      fuel_rate_gph: 6.5,
      instant_kml: 6.25,
      instant_mpg: 8.44,
      tire_pressure_psi: 104,
      idle_pct: 9,
      rail_pressure_bar: 1640,
      def_level_pct: 84,
    },
    notes: "Flat highway cruising along Punjab agricultural breadbasket corridor. Zero active fault codes, nominal common rail pressure (1640 bar) and peak 6.25 km/l fuel economy.",
    history: [
      {
        date: "2026-08-30",
        engine_hours: 3050,
        avg_kml: 6.20,
        avg_mpg: 8.3,
        coolant_temp_peak_c: 88,
        voltage_min_v: 27.8,
        dtc_logged: [],
        notes: "First scheduled PM service at Tata Commercial Dealership Ludhiana. Air filter inspected and cleaned."
      }
    ]
  },
  {
    vehicle_id: "TATA-SIGNA-4825",
    unit_name: "Signa 4825.TK 16-Wheeler Mineral Tipper",
    make_model: "Tata Signa 4825.TK BSVI (Cummins ISBe 6.7L 250HP Bogie)",
    year: 2024,
    vin: "MAT418482Q2B48252",
    driver: "Bikash Chandra Mohapatra",
    driver_name: "Bikash Chandra Mohapatra",
    state: "Odisha",
    location: "SH-10 / NH-520 Joda-Barbil Iron Ore Mining Corridor, Keonjhar, Odisha",
    coordinates: {
      lat: 22.0120,
      lng: 85.4280,
      heading: 140,
      altitude_m: 465,
      landmark: "Barbil-Joda Mineral Weighbridge & Rungta Mines Gate 2",
      route_corridor: "NH-520 Keonjhar-Kalinganagar Mineral Express Highway (Odisha)",
      state: "Odisha",
    },
    engine_hours: 4150,
    payload: "34.0 Ton High-Grade Crushed Hematite Iron Ore Fines (For Tata Steel Kalinganagar)",
    gvw_tons: 47.5,
    load_type: "Bulk Mining & Heavy Mineral Ore",
    status: "WARNING",
    telemetry: {
      engine_load_pct: 78,
      coolant_temp_c: 94,
      battery_voltage_v: 23.4,
      exhaust_temp_c: 440,
      nox_sensor_ppm: 310,
      active_dtc_codes: ["P0562"],
      soot_level_g: 18.2,
      speed_kmh: 56,
      speed_mph: 35,
      fuel_rate_lph: 36.8,
      fuel_rate_gph: 9.7,
      instant_kml: 4.15,
      instant_mpg: 5.60,
      tire_pressure_psi: 112,
      idle_pct: 22,
      rail_pressure_bar: 1520,
      def_level_pct: 68,
    },
    notes: "16-wheeler heavy quarry tipper in Keonjhar mineral belt, Odisha. Operating near maximum payload; system voltage 23.4V under hydraulic tipping load.",
    history: [
      {
        date: "2026-09-05",
        engine_hours: 4050,
        avg_kml: 4.10,
        avg_mpg: 5.5,
        coolant_temp_peak_c: 95,
        voltage_min_v: 23.2,
        dtc_logged: ["P0562"],
        notes: "Alternator belt tension calibrated at Tata Commercial Hub Barbil. Dual 24V batteries tested under load."
      },
      {
        date: "2026-08-14",
        engine_hours: 3750,
        avg_kml: 4.25,
        avg_mpg: 5.7,
        coolant_temp_peak_c: 92,
        voltage_min_v: 24.5,
        dtc_logged: [],
        notes: "Heavy-duty bogie suspension leaf springs torqued to OEM specifications for rough mineral haul roads."
      }
    ]
  },
  {
    vehicle_id: "TATA-SIGNA-5530",
    unit_name: "Signa 5530.S Cryogenic Hazmat Tanker",
    make_model: "Tata Signa 5530.S (Cummins ISBe 300HP / G1150 9-Speed)",
    year: 2022,
    vin: "MAT416553N1C55303",
    driver: "Vikram Rathore",
    driver_name: "Vikram Rathore",
    state: "Gujarat",
    location: "NE-1 / NH-48 Dahej Chemical SEZ Expressway, Bharuch-Surat, Gujarat",
    coordinates: {
      lat: 21.7140,
      lng: 72.9820,
      heading: 195,
      altitude_m: 22,
      landmark: "Dahej Petroleum & Petrochemicals SEZ Gate 1 Weigh Station",
      route_corridor: "NE-1 / NH-48 Golden Industrial Freight Corridor (Gujarat)",
      state: "Gujarat",
    },
    engine_hours: 11800,
    payload: "32.0 Ton Cryogenic Liquid Argon / Industrial Liquefied Gas Tanker",
    gvw_tons: 55.0,
    load_type: "Hazmat Cryogenic Industrial Chemicals",
    status: "WARNING",
    telemetry: {
      engine_load_pct: 72,
      coolant_temp_c: 92,
      battery_voltage_v: 24.8,
      exhaust_temp_c: 510,
      nox_sensor_ppm: 460,
      active_dtc_codes: ["P2463", "P20EE"],
      soot_level_g: 34.8,
      speed_kmh: 68,
      speed_mph: 42,
      fuel_rate_lph: 38.4,
      fuel_rate_gph: 10.1,
      instant_kml: 4.35,
      instant_mpg: 5.88,
      tire_pressure_psi: 110,
      idle_pct: 16,
      rail_pressure_bar: 1580,
      def_level_pct: 48,
    },
    notes: "Specialized cryogenic tanker in Gujarat chemical hub; DPF soot accumulation at 34.8g nearing threshold, SCR efficiency alert active.",
    history: [
      {
        date: "2026-09-08",
        engine_hours: 11720,
        avg_kml: 4.25,
        avg_mpg: 5.7,
        coolant_temp_peak_c: 94,
        voltage_min_v: 24.6,
        dtc_logged: ["P2463"],
        notes: "Stationary regeneration recommended. Soot mass logged at 31g during pre-trip."
      },
      {
        date: "2026-08-20",
        engine_hours: 11400,
        avg_kml: 4.45,
        avg_mpg: 6.0,
        coolant_temp_peak_c: 91,
        voltage_min_v: 24.9,
        dtc_logged: ["P20EE"],
        notes: "DEF dosing nozzle purged and cleaned of urea crusting at Bharuch commercial depot."
      }
    ]
  },
  {
    vehicle_id: "TATA-SIGNA-2823",
    unit_name: "Signa 2823.K Heavy Steel Hauler",
    make_model: "Tata Motors Signa 2823.K BSVI (3.3L Turbotronn NG / Bosch MD1CS018)",
    year: 2023,
    vin: "MAT416042N1A28230",
    driver: "Rajesh Sharma",
    driver_name: "Rajesh Sharma",
    state: "Maharashtra",
    location: "Mumbai-Pune Expressway, Bhor Ghat Incline (KM 64 Viaduct), Maharashtra",
    coordinates: {
      lat: 18.7546,
      lng: 73.3426,
      heading: 118,
      altitude_m: 595,
      landmark: "Bhor Ghat Viaduct Section (KM 64)",
      route_corridor: "Mumbai-Pune Expressway (NH-48), Maharashtra",
      state: "Maharashtra",
    },
    engine_hours: 14200,
    payload: "21.5 Ton Hot-Rolled High-Tensile Steel Coils",
    gvw_tons: 28.0,
    load_type: "Heavy Industrial Steel Flatbed",
    status: "CRITICAL",
    telemetry: {
      engine_load_pct: 94,
      coolant_temp_c: 106,
      battery_voltage_v: 23.8,
      exhaust_temp_c: 620,
      nox_sensor_ppm: 820,
      active_dtc_codes: ["P0192-00", "P244B-00", "P2047-00"],
      soot_level_g: 38.6,
      speed_kmh: 48,
      speed_mph: 30,
      fuel_rate_lph: 48.2,
      fuel_rate_gph: 12.7,
      instant_kml: 3.45,
      instant_mpg: 4.65,
      tire_pressure_psi: 110,
      idle_pct: 22,
      rail_pressure_bar: 840,
      def_level_pct: 28,
    },
    notes: "Tata BSVI Turbotronn engine derated by 25% on 6% Bhor Ghat climb due to Common Rail Sensor short to ground & DPF restriction.",
    history: [
      {
        date: "2026-09-12",
        engine_hours: 14120,
        avg_kml: 3.65,
        avg_mpg: 4.9,
        coolant_temp_peak_c: 104,
        voltage_min_v: 23.9,
        dtc_logged: ["P0192-00"],
        notes: "Driver reported sudden loss of uphill pulling power on Bhor Ghat incline. Rail pressure error logged."
      },
      {
        date: "2026-08-28",
        engine_hours: 13800,
        avg_kml: 3.90,
        avg_mpg: 5.3,
        coolant_temp_peak_c: 96,
        voltage_min_v: 24.4,
        dtc_logged: ["P244B-00"],
        notes: "Manual DPF regeneration attempted at depot. Soot load above threshold (32g)."
      },
      {
        date: "2026-08-10",
        engine_hours: 13350,
        avg_kml: 4.15,
        avg_mpg: 5.6,
        coolant_temp_peak_c: 92,
        voltage_min_v: 24.6,
        dtc_logged: [],
        notes: "Oil and oil filter replaced. DEF filter replaced at 120,000 km interval."
      }
    ]
  },
  {
    vehicle_id: "TATA-LPT-1918",
    unit_name: "LPT 1918 Cowl Inter-State Express Carrier",
    make_model: "Tata LPT 1918 Cowl BSVI (5.0L Turbotronn 180HP / G750 6-Speed)",
    year: 2023,
    vin: "MAT415019M3B19185",
    driver: "Karthik Subramanian",
    driver_name: "Karthik Subramanian",
    state: "Tamil Nadu",
    location: "NH-44 Bengaluru-Hosur Auto Corridor, Zuzuvadi Commercial Border, Tamil Nadu",
    coordinates: {
      lat: 12.7820,
      lng: 77.8180,
      heading: 165,
      altitude_m: 875,
      landmark: "Zuzuvadi Inter-State Commercial Border & TVS Industrial Hub",
      route_corridor: "NH-44 Bengaluru-Hosur-Chennai Auto Logistics Artery (Tamil Nadu)",
      state: "Tamil Nadu",
    },
    engine_hours: 6900,
    payload: "12.8 Ton Precision Automotive Transmissions, Wiring Harnesses & EV Modules",
    gvw_tons: 18.5,
    load_type: "Automotive OEM Supply Chain Freight",
    status: "NORMAL",
    telemetry: {
      engine_load_pct: 54,
      coolant_temp_c: 88,
      battery_voltage_v: 27.6,
      exhaust_temp_c: 350,
      nox_sensor_ppm: 62,
      active_dtc_codes: [],
      soot_level_g: 12.4,
      speed_kmh: 72,
      speed_mph: 45,
      fuel_rate_lph: 27.8,
      fuel_rate_gph: 7.3,
      instant_kml: 5.45,
      instant_mpg: 7.35,
      tire_pressure_psi: 106,
      idle_pct: 12,
      rail_pressure_bar: 1610,
      def_level_pct: 76,
    },
    notes: "Interstate industrial corridor cruise toward Chennai automotive belt. All telemetry within optimal green thresholds.",
    history: [
      {
        date: "2026-09-01",
        engine_hours: 6780,
        avg_kml: 5.40,
        avg_mpg: 7.3,
        coolant_temp_peak_c: 89,
        voltage_min_v: 27.5,
        dtc_logged: [],
        notes: "Tire pressure checked and balanced to 106 PSI across all 6 dual drive positions at Hosur."
      }
    ]
  },
  {
    vehicle_id: "TATA-PRIMA-3530",
    unit_name: "Prima 3530.K Heavy Industrial Metallurgical Tipper",
    make_model: "Tata Motors Prima 3530.K BSVI (Cummins ISBe 6.7L 300HP / MD1CS018)",
    year: 2023,
    vin: "MAT418035M2B35301",
    driver: "Manoj Soren",
    driver_name: "Manoj Soren",
    state: "Jharkhand",
    location: "NH-18 Tata Steel Works Logistics Gate 3 (Burmamines), Jamshedpur, Jharkhand",
    coordinates: {
      lat: 22.8050,
      lng: 86.2020,
      heading: 85,
      altitude_m: 165,
      landmark: "Tata Steel Jamshedpur Works Logistics Gate 3 (Burmamines)",
      route_corridor: "NH-18 Jamshedpur-Kharagpur Steel Freight Arterial (Jharkhand)",
      state: "Jharkhand",
    },
    engine_hours: 9100,
    payload: "26.5 Ton Hot-Rolled High-Tensile Steel Wire Rods & Fabricated Beams",
    gvw_tons: 35.0,
    load_type: "Heavy Metallurgical Steel & Castings",
    status: "WARNING",
    telemetry: {
      engine_load_pct: 76,
      coolant_temp_c: 96,
      battery_voltage_v: 24.6,
      exhaust_temp_c: 495,
      nox_sensor_ppm: 640,
      active_dtc_codes: ["P0489-00", "P2200-86"],
      soot_level_g: 24.2,
      speed_kmh: 54,
      speed_mph: 34,
      fuel_rate_lph: 39.1,
      fuel_rate_gph: 10.3,
      instant_kml: 3.98,
      instant_mpg: 5.38,
      tire_pressure_psi: 115,
      idle_pct: 28,
      rail_pressure_bar: 1520,
      def_level_pct: 54,
    },
    notes: "EGR valve control circuit low voltage and Upstream NOx sensor communication alert logged during industrial plant dispatch in Jamshedpur.",
    history: [
      {
        date: "2026-09-08",
        engine_hours: 8990,
        avg_kml: 4.00,
        avg_mpg: 5.4,
        coolant_temp_peak_c: 96,
        voltage_min_v: 24.2,
        dtc_logged: ["P0489-00"],
        notes: "EGR throttle wiring harness wiggled at Jamshedpur workshop. Intermittent circuit low detected."
      },
      {
        date: "2026-08-20",
        engine_hours: 8600,
        avg_kml: 4.25,
        avg_mpg: 5.7,
        coolant_temp_peak_c: 91,
        voltage_min_v: 24.8,
        dtc_logged: [],
        notes: "Scheduled tipper hydraulic hoist cylinder service and grease pack."
      }
    ]
  },
  {
    vehicle_id: "TATA-ULTRA-1918",
    unit_name: "Ultra 1918.T Golden Quadrilateral Freighter",
    make_model: "Tata Ultra 1918.T (5.0L Turbotronn 180HP Container Spec)",
    year: 2024,
    vin: "MAT417019R3A19188",
    driver: "Devendra Singh Shekhawat",
    driver_name: "Devendra Singh Shekhawat",
    state: "Rajasthan",
    location: "NH-48 Jaipur-Delhi Freight Expressway, Neemrana Industrial Zone, Rajasthan",
    coordinates: {
      lat: 27.9890,
      lng: 76.3880,
      heading: 42,
      altitude_m: 310,
      landmark: "Neemrana Japanese Industrial Zone & Shahjahanpur Toll Plaza",
      route_corridor: "NH-48 Western Dedicated Freight Highway (Rajasthan Corridor)",
      state: "Rajasthan",
    },
    engine_hours: 2450,
    payload: "13.5 Ton Export Consumer Electronics & Precision Die Castings",
    gvw_tons: 19.0,
    load_type: "Export Containerized Electronics & Assemblies",
    status: "NORMAL",
    telemetry: {
      engine_load_pct: 50,
      coolant_temp_c: 87,
      battery_voltage_v: 27.7,
      exhaust_temp_c: 340,
      nox_sensor_ppm: 52,
      active_dtc_codes: [],
      soot_level_g: 10.8,
      speed_kmh: 76,
      speed_mph: 47,
      fuel_rate_lph: 26.2,
      fuel_rate_gph: 6.9,
      instant_kml: 5.85,
      instant_mpg: 7.89,
      tire_pressure_psi: 106,
      idle_pct: 11,
      rail_pressure_bar: 1620,
      def_level_pct: 78,
    },
    notes: "Cruising northeast toward Delhi NCR distribution hub along NH-48 Rajasthan corridor. Nominal powertrain parameters with DEF level at 78% and balanced tire pressure.",
    history: [
      {
        date: "2026-09-02",
        engine_hours: 2380,
        avg_kml: 5.80,
        avg_mpg: 7.8,
        coolant_temp_peak_c: 88,
        voltage_min_v: 27.6,
        dtc_logged: [],
        notes: "Pre-trip inspection completed at Jaipur transport terminal. All fluids topped up."
      }
    ]
  }
];

export const DTC_DATABASE: Record<string, DtcDefinition> = {
  "P2202": {
    code: "P2202",
    title: "NOx Sensor Circuit Low Voltage (Bank 1 Sensor 1)",
    component: "Selective Catalytic Reduction (SCR) / Aftertreatment",
    severity: "High",
    spn_fmi: "SPN 3216 FMI 4",
    description: "The engine ECM detected the upstream NOx sensor voltage output signal is below calibrated threshold. Causes elevated tailpipe emissions and derate if unaddressed.",
    common_symptoms: ["DEF derate count-down", "Failed emissions compliance", "MIL / Check Engine lamp illumination"]
  },
  "P0118": {
    code: "P0118",
    title: "Engine Coolant Temperature Sensor 1 Circuit High",
    component: "Thermal Management & Cooling Loop",
    severity: "Critical",
    spn_fmi: "SPN 110 FMI 3",
    description: "Coolant temperature signal circuit open or shorted high. ECM reads extreme high temp or defaults to 120°C failsafe mode, triggering engine cooling fan lock and torque limit.",
    common_symptoms: ["Cooling fan running at 100% continuously", "Erratic temperature gauge", "Engine derate or shutdown timer"]
  },
  "P2463": {
    code: "P2463",
    title: "Diesel Particulate Filter (DPF) Restriction - Soot Accumulation",
    component: "Diesel Exhaust Filtration",
    severity: "High",
    spn_fmi: "SPN 3719 FMI 16",
    description: "Differential exhaust pressure across the DPF core indicates soot accumulation beyond normal passive regeneration limit.",
    common_symptoms: ["Regen light blinking", "Loss of power under load", "High exhaust backpressure"]
  },
  "P20EE": {
    code: "P20EE",
    title: "SCR NOx Catalyst Efficiency Below Threshold (Bank 1)",
    component: "DEF / Urea Dosing & Catalyst",
    severity: "High",
    spn_fmi: "SPN 4364 FMI 18",
    description: "Conversion efficiency of the Selective Catalytic Reduction catalyst has fallen below EPA/CARB regulatory limits.",
    common_symptoms: ["DEF crystallization on injector nozzle", "NOx conversion failure", "5 mph inducement speed limit imminent"]
  },
  "P0562": {
    code: "P0562",
    title: "System Voltage Low (24V Fleet Bus)",
    component: "Electrical & Alternator Charging System",
    severity: "Medium",
    spn_fmi: "SPN 168 FMI 1",
    description: "Battery bus voltage fell below minimum operational threshold (< 24.0V on 24V systems or < 11.8V on 12V systems) while engine was running.",
    common_symptoms: ["Dimming headlamps", "Sensor signal fluctuation", "Transmission shift solenoid delay"]
  },
  "P0524": {
    code: "P0524",
    title: "Engine Oil Pressure Too Low",
    component: "Engine Lubrication & Crankcase",
    severity: "Critical",
    spn_fmi: "SPN 100 FMI 1",
    description: "Oil galley pressure dropped below safe minimum for current RPM. Immediate risk of main bearing seizure and catastrophic engine failure.",
    common_symptoms: ["Red Stop Engine lamp", "Audible valvetrain rattle", "Emergency ECM shutdown timer"]
  },
  "P0299": {
    code: "P0299",
    title: "Turbocharger / Supercharger Underboost Condition",
    component: "Forced Induction & Charge Air Cooler",
    severity: "Medium",
    spn_fmi: "SPN 102 FMI 18",
    description: "Boost pressure delivered to intake manifold is significantly lower than requested by ECM mapping.",
    common_symptoms: ["Sluggish acceleration", "Black exhaust smoke", "Hissing boot clamp leak"]
  },
  "P0101": {
    code: "P0101",
    title: "Mass or Volume Air Flow Circuit Range/Performance",
    component: "Intake Air Metering",
    severity: "Low",
    spn_fmi: "SPN 132 FMI 2",
    description: "MAF signal does not correlate with calculated manifold absolute pressure and engine RPM.",
    common_symptoms: ["Poor fuel economy", "Hesitation during gear shift"]
  }
};

// Merge all Tata Motors BSVI DTCs into the central DTC database
TATA_MOTORS_BSVI_DTC_LIST.forEach((item) => {
  const severityLevel: 'Low' | 'Medium' | 'High' | 'Critical' =
    item.effectOnVehicle.toLowerCase().includes('stop') ||
    item.effectOnVehicle.toLowerCase().includes('no start') ||
    item.effectOnVehicle.toLowerCase().includes('engine stop') ||
    item.category === 'Fuel & Common Rail' && item.title.toLowerCase().includes('critical')
      ? 'Critical'
      : item.effectOnVehicle.toLowerCase().includes('torque') ||
        item.effectOnVehicle.toLowerCase().includes('derate') ||
        item.effectOnVehicle.toLowerCase().includes('inducement')
      ? 'High'
      : item.effectOnVehicle.toLowerCase().includes('smoke') ||
        item.effectOnVehicle.toLowerCase().includes('mil')
      ? 'Medium'
      : 'Low';

  const definition: DtcDefinition = {
    code: item.code,
    title: `[Tata BSVI] ${item.title}`,
    component: `Tata BSVI - ${item.subsystem} (${item.category})`,
    severity: severityLevel,
    spn_fmi: `Tata BSVI / Bosch MD1CS018 (${item.category})`,
    description: `${item.title}. Subsystem: ${item.subsystem}. Vehicle effect: ${item.effectOnVehicle}. MIL: ${item.milStatus}. Schematic note: ${item.schematicNote || 'Standard Bosch MD1CS018 wiring'}.`,
    common_symptoms: item.causes.concat([`Effect: ${item.effectOnVehicle}`, `MIL Status: ${item.milStatus}`]),
    milStatus: item.milStatus,
    effectOnVehicle: item.effectOnVehicle,
    checkpoints: item.checkpoints,
    steps: item.steps,
    schematicNote: item.schematicNote
  };

  // Register both full code (P0192-00) and base code (P0192) if not already set
  DTC_DATABASE[item.code] = definition;
  if (item.baseCode && !DTC_DATABASE[item.baseCode]) {
    DTC_DATABASE[item.baseCode] = {
      ...definition,
      code: item.baseCode
    };
  }
});

// Precomputed instant baseline diagnostics for TATA-PRIMA-5530 so app loads with valid data without unwanted initial scan
export const INITIAL_DIAGNOSTIC_RESULT: DiagnosticResult = {
  health_score: 74,
  status: 'WARNING',
  primary_diagnosis: 'Elevated engine coolant temperature (104°C) combined with active NOx Sensor Bank 1 Circuit DTC P2202 and Engine Coolant Temperature Sensor 1 Circuit High DTC P0118 under high-altitude Himalayan mountain gradient.',
  failure_probability_next_24h: 38,
  required_parts: [
    'Smart NOx Sensor Bank 1 Pre-DOC (Part # 570114810101)',
    'Dual Engine Thermostat Kit (82°C Opening Spec)',
    'Viscous Cooling Fan Bimetallic Drive'
  ],
  action_plan: [
    'Allow engine to idle and confirm viscous cooling fan full lockup before terminal shutdown.',
    'Inspect Bank 1 upstream NOx sensor wiring connector and verify 24V supply on pin 1.',
    'Schedule stationary parked DPF regeneration upon reaching Qazigund freight terminal.'
  ],
  estimated_cost_inr: 28500,
  timestamp: 'Baseline Diagnostic Ready',
  _engine: 'Tata FleetDiag Baseline AI'
};

export const INITIAL_FUEL_RESULT: FuelEfficiencyResult = {
  vehicle_id: 'TATA-PRIMA-5530',
  current_kml: 3.82,
  baseline_expected_kml: 5.2,
  efficiency_rating: 'FAIR',
  fuel_rate_lph: 41.5,
  idle_fuel_percentage: 18,
  potential_causes: [
    {
      factor: 'Mountain Grade & Sustained 86% Engine Load',
      impact_kml: -0.75,
      description: 'Continuous heavy haul climb on Pir Panjal grade increases fuel burn rate.',
      severity: 'MODERATE'
    },
    {
      factor: 'DPF Particulate Backpressure (28.4g Soot)',
      impact_kml: -0.45,
      description: 'Exhaust restriction increases diesel pumping losses across DPF core.',
      severity: 'MODERATE'
    }
  ],
  actionable_recommendations: [
    'Maintain optimal engine speed in 1100–1500 RPM green torque plateau during hill climbs.',
    'Execute forced parked DPF regeneration at next depot stop to lower backpressure.'
  ],
  estimated_monthly_savings_inr: 32000,
  timestamp: 'Baseline Diagnostic Ready',
  _engine: 'Tata FleetDiag Baseline AI'
};

export const INITIAL_PREDICTIVE_RESULT: PredictiveMaintenanceResult = {
  vehicle_id: 'TATA-PRIMA-5530',
  recurring_issues: [
    {
      issue_name: 'NOx Sensor Circuit Thermal Cycling',
      frequency_last_90d: 2,
      root_cause_trend: 'High thermal cycling in Himalayan highway operation causing sensor resistance drift.',
      severity: 'High'
    }
  ],
  common_failure_patterns: [
    'Coolant temps elevate above 100°C when ambient is cool but gradient exceeds 5%.',
    'Soot loading rate accelerates during mountain crawls under 45 KMPH.'
  ],
  predicted_maintenance_needs: [
    {
      component: 'Smart NOx Sensor Bank 1 (Upstream)',
      predicted_failure_window: 'Within 150–200 engine hours',
      confidence_pct: 88,
      recommended_action: 'Verify connector pin tension and clean sensor harness shield.',
      estimated_cost_inr: 28900
    },
    {
      component: 'DPF Core Regeneration / Baking',
      predicted_failure_window: 'Within 50 engine hours (Parked Regen Required)',
      confidence_pct: 92,
      recommended_action: 'Perform stationary DPF regeneration cycle.',
      estimated_cost_inr: 12500
    }
  ],
  recommended_schedule_adjustments: [
    {
      task: 'Radiator airflow cleaning & Coolant check',
      current_interval: 'Every 60,000 km',
      recommended_interval: 'Every 30,000 km',
      reasoning: 'Heavy altitude duty cycle induces elevated thermal stress.'
    }
  ],
  estimated_downtime_cost_inr: 85000,
  timestamp: 'Baseline Diagnostic Ready',
  _engine: 'Tata FleetDiag Baseline AI'
};

