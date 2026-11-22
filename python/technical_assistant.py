"""
Commercial Vehicle Master Technician Q&A and Pinout Knowledge Engine
Written in Python 3 (Standard Library - zero external dependencies)
"""

from typing import Dict, Any


def answer_technical_query(question: str, snapshot: Dict[str, Any], diagnostic_result: Dict[str, Any] = None) -> str:
    """
    Returns concise, practical workshop answers with exact torque specs,
    wiring pinouts, Bosch ECU pin references, and safety protocols.
    """
    q = question.lower()
    vehicle_id = snapshot.get("vehicle_id", "FLEET-ACTIVE")
    telemetry = snapshot.get("telemetry", {})
    dtcs = telemetry.get("active_dtc_codes", [])
    soot = float(telemetry.get("soot_level_g", 18))
    coolant = float(telemetry.get("coolant_temp_c", 90))
    voltage = float(telemetry.get("battery_voltage_v", 27.5))
    load = float(telemetry.get("engine_load_pct", 50))

    if "torque" in q and ("nox" in q or "sensor" in q):
        return (
            f"[Workshop Specification — Unit {vehicle_id}]\n"
            "• Smart NOx Sensor (M20x1.5 Boss): 50 ± 5 Nm (37 ± 3 ft-lbs). Always apply high-temperature nickel anti-seize strictly to sensor threads; do not contaminate the porous zirconia tip.\n"
            "• NOx Sensor Control Module Bracket Fasteners (M6): 9.5 ± 1.5 Nm.\n"
            "• Retorque Check: Retorque after initial road test if a replacement stainless exhaust boss was welded."
        )

    if "torque" in q:
        return (
            f"[Heavy-Duty Torque Specifications — Unit {vehicle_id}]\n"
            "• Wheel Hub Outer Cap Nuts (M22x1.5): 650 ± 50 Nm (480 ft-lbs), cross-star pattern.\n"
            "• Fuel Rail Pressure Sensor (Bosch MD1CS018): 35 ± 3 Nm.\n"
            "• DPF Exhaust Marmon V-Band Clamps: 14 ± 2 Nm.\n"
            "• Oil Pan Drain Plug: 80 ± 5 Nm.\n"
            "• Cylinder Head Bolts (M14): Stage 1: 60 Nm, Stage 2: 120 Nm, Stage 3: +90° turn."
        )

    if any(k in q for k in ["limp", "safe", "mile", "drive", "continue"]):
        if coolant >= 105 or "P0524" in dtcs:
            return (
                f"[CRITICAL SAFETY WARNING — Unit {vehicle_id}]\n"
                f"DO NOT LIMP THIS VEHICLE. Coolant temperature ({coolant:.1f}°C) or engine oil pressure status indicates immediate catastrophic risk of cylinder head warpage or rod bearing seizure. Shut down engine and dispatch flatbed recovery immediately."
            )
        if soot >= 35.0 or any(c.startswith(("P244", "P2200", "P0192")) for c in dtcs):
            return (
                f"[BSVI Limp-Mode Advisory — Unit {vehicle_id}]\n"
                "Vehicle is operating under ECU inducement torque derate (25% torque cap, with 20 km/h creep limit pending). Limping short distances (< 10 km) to an authorized workshop at low speed is mechanically permissible, but do not exceed 40 km/h or climb steep highway gradients."
            )
        return (
            f"[Limp Evaluation — Unit {vehicle_id}]\n"
            f"Current sensor telemetry indicates vehicle is mechanically capable of driving to the nearest depot under caution. Maintain continuous monitoring of coolant temperature (< 98°C) and oil pressure gauges."
        )

    if any(k in q for k in ["coolant", "thermostat", "head gasket", "overheat"]):
        return (
            f"[Cooling System Diagnostic Procedure — Unit {vehicle_id}]\n"
            "1. Thermostat Evaluation: Upper radiator hose must remain cool until engine reaches 82°C (180°F) crack-open temp, then warm rapidly. If delta-T between top and bottom radiator tanks exceeds 25°C under load, thermostat is restricted or radiator core is scaled.\n"
            "2. Combustion Gas Sniff Test: Install chemical CO2 detector on expansion tank neck. If blue fluid turns yellow/green under load, combustion chamber is pressurizing the cooling jacket (head gasket or EGR cooler leak).\n"
            "3. Viscous Fan Clutch: Measure fan slip speed; duty cycle must achieve >90% lockup when coolant reaches 98°C."
        )

    if any(k in q for k in ["alternator", "ripple", "voltage", "battery"]):
        return (
            f"[24V Commercial Bus Electrical Specification — Unit {vehicle_id}]\n"
            f"• Current Measured Bus Voltage: {voltage:.1f}V (Nominal: 27.6V - 28.6V at 1,500 engine RPM).\n"
            "• Maximum Acceptable AC Ripple: < 0.40V AC (RMS) measured across positive B+ stud and alternator case ground with True-RMS DMM under 50% electrical load.\n"
            "• Failure Symptom: AC ripple > 0.5V AC induces false sensor errors in Bosch MD1CS018 ECU analog-to-digital converters, causing sporadic CAN bus fault codes."
        )

    if any(k in q for k in ["dpf", "regen", "soot", "aftertreatment"]):
        return (
            f"[Tata BSVI DPF Regeneration Protocol — Unit {vehicle_id}]\n"
            f"• Current Soot Mass: {soot:.1f}g (Nominal: < 18g | Active Regen: 18-28g | Parked Regen: 28-40g | Creep Derate: > 40g).\n"
            "• Stationary Parked Regen Conditions:\n"
            "  1. Park brake applied, transmission in NEUTRAL.\n"
            "  2. Engine coolant temp > 70°C and DEF quality > 32.5%.\n"
            "  3. Exhaust tailpipe area cleared of flammable debris (temps reach 600°C).\n"
            "  4. Hold dash DPF Regen switch for 5 seconds or trigger via diagnostic service tool."
        )

    dtc_str = ", ".join(dtcs) if dtcs else "None"
    return (
        f"[Master Technician Guidance — Unit {vehicle_id}]\n"
        f"• Active DTCs: {dtc_str}\n"
        f"• Telemetry: Coolant {coolant:.1f}°C, Voltage {voltage:.1f}V, DPF Soot {soot:.1f}g, Engine Load {load:.0f}%.\n"
        "• Protocol: Check sensor harness pin tension, inspect 24V ground bonding, verify coolant flow, and measure CAN termination resistance (60Ω across CAN-H and CAN-L) before clearing fault codes."
    )
