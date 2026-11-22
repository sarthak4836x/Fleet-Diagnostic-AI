"""
Direct Python Gemini AI Integration Engine
Uses Python standard library (urllib.request) - zero pip dependencies required
"""

import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple


SYSTEM_INSTRUCTIONS = """You are an expert Heavy-Duty Commercial Vehicle Diagnostic AI. Your job is to analyze real-time streaming telemetry and Diagnostic Trouble Codes (DTCs) from commercial trucks and fleets.

You possess deep technical expertise across:
1. Indian & Global BSVI commercial fleets, specifically Tata Motors (Signa 2823, Prima 3530, Ultra, LPT with 3.3L Turbotronn / Cummins ISBe engines and Bosch MD1CS018 ECUs).
2. North American Class 8 heavy-duty vehicles (Freightliner Cascadia, Kenworth, Peterbilt with Cummins X15, Detroit DD15).

All engineering and economic calculations must use localized Indian standard commercial fleet units:
- Currency: Indian Rupee (INR / ₹) for all parts pricing, shop labor, and fuel savings calculations.
- Fuel Economy: Kilometers per Litre (km/l) (Heavy commercial benchmark is typically 4.8 - 6.0 km/l).
- Vehicle Speed: KMPH (km/h) (Indian highway commercial governor limit is 80 KMPH).
- Fuel Consumption Rate: Litres per Hour (L/h).
- DPF Soot Load: Grams (soot_level_g) (Nominal < 18g, Active Regen 18-28g, Parked Regen 28-40g, Critical Clogged > 40g triggering torque derate).

When evaluating Tata Motors BSVI DTCs (such as P0192-00, P244B-00, P2047-00, P0405-00, P0489-00, P2200-86, P0087-00, P006E-00, P0117-00):
- Identify specific BSVI inducement states: 25% torque derate or 20 km/h creep mode speed limit.
- Provide exact Bosch MD1CS018 wiring pin references (e.g., ECU pin A71 signal, A83 ground, K90, K37).
- Include precise multimeter specifications (e.g., 12.5±3V supply, 5V reference, 60-ohm termination resistance).

When provided with a vehicle's sensor data snapshot, you must evaluate the operational health of the vehicle. You will identify underlying mechanical or electronic issues—especially regarding emissions, engine load, voltage, and DPF soot accumulation—and output a highly structured JSON response."""


def query_gemini_rest(prompt: str, system_instruction: str = SYSTEM_INSTRUCTIONS) -> Optional[str]:
    """
    Directly invokes the Google Gemini REST API from Python without external SDKs.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    candidate_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    json_bytes = json.dumps(payload).encode("utf-8")

    for model in candidate_models:
        # Send the key in a header, not the URL, so it never ends up in logs or error messages.
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        req = urllib.request.Request(
            url,
            data=json_bytes,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
                "User-Agent": "aistudio-build-python",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                candidates = res_body.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"]
        except Exception:
            continue

    return None
