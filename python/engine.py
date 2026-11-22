#!/usr/bin/env python3
"""
FleetDiag AI Unified Commercial Vehicle Diagnostics Engine
Unified CLI & IPC dispatcher in Python 3.
"""

import sys
import os
import json
import argparse
from typing import Dict, Any

# Ensure local python directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from telematics_analyzer import evaluate_diagnostics
from fuel_efficiency import evaluate_fuel_efficiency
from predictive_maintenance import evaluate_predictive_maintenance
from technical_assistant import answer_technical_query
from gemini_service import query_gemini_rest


def main():
    parser = argparse.ArgumentParser(description="FleetDiag AI Python Diagnostics Core")
    parser.add_argument("mode", choices=["diagnose", "fuel", "predictive", "query", "info"], help="Operation mode")
    parser.add_argument("--input", "-i", type=str, default="", help="JSON string payload (if omitted, reads stdin)")
    args = parser.parse_args()

    if args.mode == "info":
        info = {
            "runtime": "Python",
            "version": sys.version,
            "engine": "FleetDiag Commercial Diagnostics Core v3.8",
            "telematics_standard": "SAE J1939 / Tata Motors BSVI / Cummins ISBe",
            "status": "ready",
        }
        print(json.dumps(info, indent=2))
        return

    # Read input payload
    payload_str = args.input.strip()
    if not payload_str:
        payload_str = sys.stdin.read().strip()

    if not payload_str:
        payload = {}
    else:
        try:
            payload = json.loads(payload_str)
        except Exception as e:
            print(json.dumps({"error": f"Invalid JSON payload: {str(e)}"}), file=sys.stderr)
            sys.exit(1)

    if args.mode == "diagnose":
        # First attempt Python Gemini API if configured, else physics-based rule engine
        snapshot = payload
        ai_res = None
        try:
            prompt = f"Analyze this vehicle snapshot:\n{json.dumps(snapshot, indent=2)}"
            raw_ai = query_gemini_rest(prompt)
            if raw_ai:
                ai_res = json.loads(raw_ai)
                ai_res["_engine"] = "python_gemini_rest_v2"
        except Exception:
            ai_res = None

        if ai_res:
            result = ai_res
        else:
            result = evaluate_diagnostics(snapshot)
        print(json.dumps(result))

    elif args.mode == "fuel":
        result = evaluate_fuel_efficiency(payload)
        print(json.dumps(result))

    elif args.mode == "predictive":
        vehicle_id = payload.get("vehicle_id", "FLEET-ACTIVE")
        history = payload.get("history", [])
        snapshot = payload.get("snapshot", payload)
        result = evaluate_predictive_maintenance(vehicle_id, history, snapshot)
        print(json.dumps(result))

    elif args.mode == "query":
        question = payload.get("question") or payload.get("message") or payload.get("prompt", "")
        snapshot = payload.get("snapshot", {})
        diag_res = payload.get("diagnosticResult", {})
        answer = answer_technical_query(question, snapshot, diag_res)
        print(json.dumps({"answer": answer, "_engine": "python_technical_assistant_v3"}))


if __name__ == "__main__":
    main()
