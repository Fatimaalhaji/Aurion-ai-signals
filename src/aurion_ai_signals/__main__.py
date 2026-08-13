"""Minimal HTTP entry point for Aurion AI Signals."""

from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

HEALTH_RESPONSE: dict[str, str] = {"status": "ok", "message": "Aurion AI Signals is running"}


class HealthHandler(BaseHTTPRequestHandler):
    """Serve deterministic health responses for the app."""

    server_version = "AurionAISignals/0.1"

    def do_GET(self) -> None:
        """Return health JSON for the root and health endpoints."""
        if self.path in {"/", "/health", "/healthz"}:
            self._send_json(HTTPStatus.OK, HEALTH_RESPONSE)
            return

        self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def log_message(self, format: str, *args: Any) -> None:
        """Keep request logging concise and deterministic."""
        print(f"{self.address_string()} - {format % args}")

    def _send_json(self, status: HTTPStatus, payload: dict[str, str]) -> None:
        body = json.dumps(payload, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the Aurion AI Signals HTTP server.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument("--port", default=8000, type=int, help="Port to listen on.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    server = ThreadingHTTPServer((args.host, args.port), HealthHandler)
    print(f"Aurion AI Signals is running at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Shutting down Aurion AI Signals")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
