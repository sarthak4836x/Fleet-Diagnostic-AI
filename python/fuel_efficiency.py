"""
Commercial Vehicle Heavy-Duty Fuel Efficiency & Powertrain Loss Model
Written in Python 3 (Standard Library - zero external dependencies)
"""

from typing import Dict, List, Any


def evaluate_fuel_efficiency(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes fuel economy deviations against baseline standard fleet (5.4 km/l).
    Evaluates:
    - DPF backpressure restriction losses
    - Rolling drag penalty from tire inflation
    - Parasitic cooling fan clutch drag
    - Continuous engine load and grade climb
    - BSVI ECU torque derate fuel trims
    - Idle consumption losses
    - Financial monthly savings in INR (₹)
    """
    telemetry = snapshot.get("telemetry", {})
    load = float(telemetry.get("engine_load_pct", 50))
    coolant = float(telemetry.get("coolant_temp_c", 90))
    tire_psi = float(telemetry.get("tire_pressure_psi", 100))
    dtc_list = telemetry.get("active_dtc_codes", [])
    speed = float(telemetry.get("speed_kmh", 75))
    idle_pct = float(telemetry.get("idle_pct", 15))
    soot_level = float(telemetry.get("soot_level_g", 18))

    baseline_kml = 5.4
    current_kml = float(telemetry.get("instant_kml", 3.9))

    causes: List[Dict[str, Any]] = []

    # 1. DPF Particulate Soot Restriction
    if soot_level >= 28.0:
        causes.append({
            "factor": f"DPF Particulate Soot Restriction ({soot_level:.1f}g vs 18g threshold)",
            "impact_kml": -0.65,
            "description": "High exhaust backpressure across overloaded DPF core increases pumping losses and forces frequent active diesel post-injection regeneration cycles.",
            "severity": "SEVERE",
        })

    # 2. Low Tire Inflation Drag
    if tire_psi < 95:
        psi_diff = 105 - tire_psi
        impact = round(-0.025 * (psi_diff / 5.0), 2)
        drag_pct = round(psi_diff * 0.9)
        causes.append({
            "factor": f"Low Tire Inflation ({tire_psi:.0f} PSI vs 105 PSI Target)",
            "impact_kml": impact,
            "description": f"Underinflated steer and drive tires increase rolling drag by {drag_pct}%, elevating highway diesel consumption.",
            "severity": "SEVERE" if psi_diff > 15 else "MODERATE",
        })

    # 3. Continuous Engine Load / Gradient
    if load > 80:
        causes.append({
            "factor": f"High Continuous Engine Load ({load:.0f}%)",
            "impact_kml": -0.85,
            "description": "Heavy freight gradient climb forces engine ECU into maximum torque fuel enrichment map at high boost.",
            "severity": "SEVERE",
        })

    # 4. Cooling Fan Clutch 100% Lock
    if coolant >= 104 or "P0118" in dtc_list:
        causes.append({
            "factor": f"Cooling Fan Clutch 100% Lock ({coolant:.0f}°C)",
            "impact_kml": -0.60,
            "description": "Engine thermal load forces mechanical viscous fan clutch drive engagement, creating up to 35-45 HP direct parasitic crankshaft drag.",
            "severity": "SEVERE",
        })

    # 5. BSVI Emissions System Derate Fuel Trim
    if any(c.startswith(("P244", "P22", "P20")) for c in dtc_list):
        causes.append({
            "factor": "BSVI Emissions System Derate Fuel Trim",
            "impact_kml": -0.50,
            "description": "Aftertreatment DTCs trigger ECU safety derate trim, altering injection timing and increasing cylinder temperature.",
            "severity": "MODERATE",
        })

    # 6. Excessive Engine Idling
    if idle_pct > 20:
        causes.append({
            "factor": f"Excessive Engine Idling ({idle_pct:.0f}%)",
            "impact_kml": -0.35,
            "description": "Prolonged vehicle idling consumes 3.5 - 4.5 Litres per hour without accumulating route distance.",
            "severity": "MODERATE",
        })

    # Efficiency Rating
    if current_kml >= 5.2:
        rating = "OPTIMAL"
    elif current_kml >= 4.5:
        rating = "FAIR"
    elif current_kml >= 3.6:
        rating = "POOR"
    else:
        rating = "CRITICAL_WASTE"

    # Indian Commercial Logistics calculation: 12,000 km/month at ₹94.50 / Litre diesel
    monthly_km = 12000
    diesel_rate_inr = 94.50
    current_monthly_liters = monthly_km / max(2.0, current_kml)
    target_monthly_liters = monthly_km / baseline_kml
    monthly_savings_inr = max(0, int(round((current_monthly_liters - target_monthly_liters) * diesel_rate_inr)))

    return {
        "vehicle_id": snapshot.get("vehicle_id", "TATA-SIGNA-2823"),
        "current_kml": round(current_kml, 2),
        "baseline_expected_kml": baseline_kml,
        "efficiency_rating": rating,
        "fuel_rate_lph": float(telemetry.get("fuel_rate_lph", 42.0)),
        "idle_fuel_percentage": idle_pct,
        "potential_causes": causes,
        "actionable_recommendations": [
            "Initiate manual parked DPF regeneration or ultrasonic filter wash to bring soot mass below 18g (recovers ~0.65 km/l).",
            "Inflate steer tires to 110 PSI cold and drive duals to 105 PSI to minimize rolling drag resistance (recovers ~0.35 km/l).",
            "Rectify Common Rail and NOx sensor DTCs to clear Bosch MD1CS018 torque derate enrichment mapping (recovers ~0.50 km/l).",
            "Enforce fleet driver automated 5-minute engine idle shutdown in depot loading bays.",
        ],
        "estimated_monthly_savings_inr": monthly_savings_inr,
        "_engine": "python_fuel_physics_model_v3",
    }
