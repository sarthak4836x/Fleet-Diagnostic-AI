"""
Tata Motors BSVI & Commercial Vehicle Heavy-Duty Telematics Diagnostic Engine
Written in Python 3 (Standard Library - zero external dependencies required)
"""

import json
from typing import Dict, List, Any, Tuple


def evaluate_diagnostics(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates real-time streaming telemetry and Diagnostic Trouble Codes (DTCs).
    Specialized for:
    - Tata Motors BSVI (Signa 2823, Prima 3530, Ultra, LPT with 3.3L Turbotronn / Cummins ISBe engines and Bosch MD1CS018 ECUs)
    - North American Class 8 heavy-duty commercial fleets
    """
    telemetry = snapshot.get("telemetry", {})
    dtc_list = telemetry.get("active_dtc_codes", [])
    coolant = float(telemetry.get("coolant_temp_c", 90))
    voltage = float(telemetry.get("battery_voltage_v", 27.5))
    nox = float(telemetry.get("nox_sensor_ppm", 200))
    load = float(telemetry.get("engine_load_pct", 50))
    exhaust = float(telemetry.get("exhaust_temp_c", 400))
    soot = float(telemetry.get("soot_level_g", 16))

    score = 95
    parts: List[str] = []
    actions: List[str] = []
    issues: List[str] = []
    estimated_cost_inr = 0

    # 1. Critical Oil Pressure Loss (SPN 100 / P0524)
    if "P0524" in dtc_list:
        score -= 60
        issues.append("Critical engine oil pressure loss")
        parts.extend(["Engine Oil Pump / Pressure Relief Valve", "Crankcase Oil Pressure Sensor (SPN 100)"])
        actions.append("IMMEDIATELY cut engine ignition to avoid connecting rod / crankshaft seizure.")
        actions.append("Perform manual mechanical oil pressure gauge verification at the filter head.")
        estimated_cost_inr += 38500

    # 2. Severe Thermal Stress / Coolant Overheat
    if coolant >= 105 or "P0118" in dtc_list:
        score -= 30
        issues.append(f"Severe thermal stress ({coolant:.1f}°C coolant temp)")
        parts.extend(["Coolant Temp Sensor (ECT 1)", "Heavy-Duty Dual Thermostat Kit", "Viscous Fan Clutch Actuator"])
        actions.append("Inspect coolant recovery tank level and check for combustion gas bubbles (head gasket test).")
        actions.append("Verify electronic viscous cooling fan drive engages at 100% duty cycle.")
        estimated_cost_inr += 14200

    # 3. Electrical Bus Collapse (24V system)
    if voltage < 24.0 or "P0562" in dtc_list:
        score -= 25
        issues.append(f"Electrical bus collapse ({voltage:.1f}V below nominal 27.5V 24V threshold)")
        parts.extend(["High-Output Brushless Alternator (160A 24V)", "Negative Ground Strap & Terminal Kit"])
        actions.append("Test alternator AC ripple voltage and verify battery post torque (15 ft-lbs).")
        actions.append("Check ECM power supply harness pin tension for fretting corrosion.")
        estimated_cost_inr += 22000

    # 4. NOx Emissions Spike / Aftertreatment
    if nox > 1000 or "P2202" in dtc_list:
        score -= 25
        issues.append(f"NOx emission spike ({nox:.0f} PPM) paired with sensor circuit fault")
        parts.extend(["Nitrogen Oxide (NOx) Recon Sensor (Bank 1 Sensor 1)", "DEF Dosing Valve Injector"])
        actions.append("Disconnect Bank 1 upstream NOx sensor plug and measure CAN high/low resistance (60 ohms).")
        actions.append("Inspect SCR catalytic converter inlet for diesel exhaust fluid crystallization.")
        estimated_cost_inr += 28900

    # 5. Exhaust Over-temperature
    if exhaust > 620:
        score -= 15
        issues.append(f"Exhaust pyrometer overload ({exhaust:.0f}°C)")
        if "Charge Air Cooler Hose Kit" not in parts:
            parts.append("Charge Air Cooler Hose Kit / Clamps")
            estimated_cost_inr += 7500
        actions.append("Perform smoke test on charge air cooler piping for boost leaks causing rich-burn heat.")

    # 6. DPF High Soot Accumulation / Delta-P
    if soot >= 28.0 or any(code in dtc_list for code in ["P2463", "P244B-00", "P244B"]):
        score -= 25
        issues.append(f"Tata BSVI DPF High Soot Accumulation ({soot:.1f}g) / Delta-P Restriction")
        parts.extend(["Diesel Particulate Filter Core (Reman)", "DPF Differential Pressure Sensor (Delta-P)"])
        actions.append("Check DPF pressure pipes for pinhole leaks or carbon clogging; measure delta-P voltage at idle.")
        actions.append("Hook up Tata diagnostic service tool and initiate stationary forced DPF regeneration.")
        estimated_cost_inr += 34500

    # 7. Tata Motors Common Rail Fault (P0192-00)
    if "P0192-00" in dtc_list or "P0192" in dtc_list:
        score -= 35
        issues.append("Tata BSVI Common Rail Pressure Sensor short to ground (25% torque derate active)")
        parts.extend(["Common Rail Pressure Sensor (Bosch MD1CS018 3-wire)", "Engine Harness Repair Lead"])
        actions.append("Verify battery bus voltage (12.5±3V or 24V bus nominal).")
        actions.append("Check continuity between Rail Pressure Sensor pin 2 and ECU pin A71 (signal line).")
        actions.append("Inspect sensor pin 2 to ECU pin A83 for short to ground.")
        estimated_cost_inr += 16500

    # 8. Tata Motors DEF Dosing Valve (P2047-00)
    if "P2047-00" in dtc_list or "P2047" in dtc_list:
        score -= 25
        issues.append("Tata BSVI DEF Dosing Valve open circuit / SCR efficiency derate")
        parts.extend(["Urea Dosing Valve Actuator (DEF Injector)", "DEF Supply Line Heating Element"])
        actions.append("Check resistance of DEF dosing valve coil (nominal 12-16 ohms).")
        actions.append("Verify wiring continuity between Urea Dosing Valve and ECU pin K90.")
        estimated_cost_inr += 19800

    # 9. Tata Motors EGR Throttle (P0489-00 / P0405-00)
    if any(code in dtc_list for code in ["P0489-00", "P0489", "P0405-00", "P0405"]):
        score -= 25
        issues.append("Tata BSVI EGR Actuator / Position Sensor circuit low")
        parts.extend(["EGR Valve Actuator Assembly with Feedback Potentiometer", "EGR Cooler Gasket Kit"])
        actions.append("Check EGR valve connector for carbon buildup or pin terminal back-out.")
        actions.append("Verify 5V reference voltage at EGR pin 1 and continuity to ECU pin K37.")
        estimated_cost_inr += 24000

    # 10. Tata Motors Upstream NOx Sensor Internal / CAN (P2200-86)
    if "P2200-86" in dtc_list or "P2200" in dtc_list:
        score -= 30
        issues.append("Tata BSVI Upstream NOx Sensor internal component failure (Inducement active)")
        parts.extend(["Smart NOx Sensor Gen 3.3 (Upstream)", "J1939 CAN Aftertreatment Harness"])
        actions.append("Measure CAN termination resistance between CAN-H and CAN-L (should be ~60 ohms).")
        actions.append("Inspect NOx sensor controller supply voltage (pin 1 to chassis ground > 23.5V).")
        estimated_cost_inr += 28900

    score = max(12, min(98, score))

    status = "HEALTHY"
    failure_prob = 5

    if score < 50 or coolant >= 106 or voltage < 23.5 or "P0524" in dtc_list:
        status = "CRITICAL_STOP"
        failure_prob = min(95, 100 - score + 10)
    elif score < 75 or len(dtc_list) > 0 or coolant > 98 or voltage < 25.0 or soot >= 28.0:
        status = "WARNING"
        failure_prob = 45

    if issues:
        primary_diagnosis = f"{' and '.join(issues)} under {load:.0f}% load, causing immediate risk to powertrain reliability."
    else:
        primary_diagnosis = "All powertrain, electrical, and aftertreatment sensors indicate nominal commercial operational parameters."

    if not actions:
        actions.append("Continue normal scheduled PM inspection at next 15,000 km interval.")
        actions.append("Verify DEF fluid reservoir level and tire pressure monitoring system.")

    if not parts:
        parts.append("None required - system within manufacturer tolerances.")
    else:
        # Workshop labor allowance
        estimated_cost_inr += 4500

    return {
        "health_score": int(score),
        "status": status,
        "primary_diagnosis": primary_diagnosis,
        "failure_probability_next_24h": int(failure_prob),
        "required_parts": parts,
        "estimated_cost_inr": int(estimated_cost_inr),
        "action_plan": actions,
        "_engine": "python_telematics_analyzer_v3",
    }
