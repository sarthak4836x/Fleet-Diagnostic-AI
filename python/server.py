"""
FleetDiag AI - Standalone Python Microservice Server
Built with Python 3 Standard Library (http.server) - zero pip dependencies required.
Can run standalone: python3 python/server.py --port 8000
"""

import os
import sys
import json
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# Ensure local python directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from telematics_analyzer import evaluate_diagnostics
from fuel_efficiency import evaluate_fuel_efficiency
from predictive_maintenance import evaluate_predictive_maintenance
from technical_assistant import answer_technical_query
from gemini_service import query_gemini_rest


MAX_BODY_BYTES = 100 * 1024  # reject oversized payloads (memory exhaustion / DoS)
# Comma-separated list of origins allowed to call this service from a browser.
ALLOWED_ORIGINS = {
    o.strip() for o in os.environ.get("PY_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
}


class DiagnosticApiHandler(BaseHTTPRequestHandler):
    server_version = "FleetDiagPython"
    sys_version = ""

    def _send_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("X-Content-Type-Options", "nosniff")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            return None
        if content_length < 0 or content_length > MAX_BODY_BYTES:
            return None
        if content_length == 0:
            return {}
        raw_body = self.rfile.read(content_length)
        try:
            parsed = json.loads(raw_body.decode("utf-8"))
        except Exception:
            return None
        return parsed if isinstance(parsed, dict) else None

    def _send_json_response(self, data, status_code=200):
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ["/api/health", "/health"]:
            self._send_json_response({"status": "ok", "engine": "FleetDiag Python Core"})
        elif path in ["/api/info", "/info"]:
            self._send_json_response({
                "runtime": "Python",
                "engine": "FleetDiag Commercial Diagnostics Core v3.8",
                "endpoints": [
                    "/api/diagnose",
                    "/api/fuel-efficiency",
                    "/api/predictive",
                    "/api/technical-query",
                ]
            })
        else:
            self._send_json_response({"error": "Not Found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()
        if body is None:
            self._send_json_response({"error": "Invalid or too large JSON body"}, 400)
            return

        try:
            self._dispatch_post(path, body)
        except Exception as exc:  # never leak stack traces to clients
            print(f"[Python Microservice] error handling {path}: {exc}", file=sys.stderr)
            self._send_json_response({"error": "Internal server error"}, 500)

    def _dispatch_post(self, path, body):
        if path == "/api/diagnose":
            result = evaluate_diagnostics(body)
            self._send_json_response(result)
        elif path in ["/api/fuel-efficiency", "/api/fuel"]:
            result = evaluate_fuel_efficiency(body)
            self._send_json_response(result)
        elif path in ["/api/predictive", "/api/predictive-maintenance"]:
            vid = body.get("vehicle_id", "FLEET-ACTIVE")
            history = body.get("history", [])
            snapshot = body.get("snapshot", body)
            result = evaluate_predictive_maintenance(vid, history, snapshot)
            self._send_json_response(result)
        elif path in ["/api/technical-query", "/api/query"]:
            q = body.get("question") or body.get("message") or body.get("prompt", "")
            snapshot = body.get("snapshot", {})
            diag_res = body.get("diagnosticResult", {})
            ans = answer_technical_query(q, snapshot, diag_res)
            self._send_json_response({"answer": ans, "_engine": "python_technical_assistant_v3"})
        else:
            self._send_json_response({"error": "Endpoint not recognized"}, 404)


def run_server(port=8000, host="127.0.0.1"):
    # Bind to localhost by default; pass --host 0.0.0.0 explicitly to expose it.
    server_address = (host, port)
    httpd = HTTPServer(server_address, DiagnosticApiHandler)
    print(f"[Python Microservice] FleetDiag Python Diagnostic Server listening on port {port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Python Microservice] Shutting down...")
        httpd.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000, help="Port to run on (default 8000)")
    parser.add_argument("--host", default="127.0.0.1", help="Interface to bind (default 127.0.0.1)")
    args = parser.parse_args()
    run_server(args.port, args.host)
