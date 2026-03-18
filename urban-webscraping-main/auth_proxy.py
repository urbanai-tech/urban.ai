"""
Auth proxy for Scrapyd — validates X-API-Key header before forwarding requests.
This runs on $PORT (Railway) and proxies to Scrapyd on localhost:6800.
"""

import os
import subprocess
import sys
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import URLError

SCRAPYD_PORT = 6801
PROXY_PORT = int(os.environ.get("PORT", "8080"))
API_KEY = os.environ.get("SCRAPYD_API_KEY", "")


def start_scrapyd():
    """Start scrapyd as a subprocess."""
    proc = subprocess.Popen(
        [sys.executable, "-m", "scrapyd", "--pidfile="],
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    return proc


def wait_for_scrapyd(timeout=30):
    """Wait until scrapyd is ready."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            urlopen(f"http://127.0.0.1:{SCRAPYD_PORT}/daemonstatus.json")
            print("[auth-proxy] Scrapyd is ready!", flush=True)
            return True
        except (URLError, ConnectionError):
            time.sleep(0.5)
    print("[auth-proxy] WARNING: Scrapyd did not start in time", flush=True)
    return False


class AuthProxyHandler(BaseHTTPRequestHandler):
    """Simple reverse proxy with API Key validation."""

    def _check_auth(self):
        if not API_KEY:
            # No key configured = no protection (backward compat)
            return True
        key = self.headers.get("X-API-Key", "")
        return key == API_KEY

    def _proxy(self):
        if not self._check_auth():
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "error", "message": "Invalid or missing API key"}')
            return

        # Read request body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # Build proxied request
        target_url = f"http://127.0.0.1:{SCRAPYD_PORT}{self.path}"
        req = Request(target_url, data=body, method=self.command)

        # Forward relevant headers
        for header in ["Content-Type", "Accept"]:
            val = self.headers.get(header)
            if val:
                req.add_header(header, val)

        try:
            with urlopen(req) as resp:
                self.send_response(resp.status)
                for key, val in resp.getheaders():
                    if key.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(key, val)
                self.end_headers()
                self.wfile.write(resp.read())
        except URLError as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f'{{"status": "error", "message": "Scrapyd unavailable: {e}"}}'.encode())

    def do_GET(self):
        self._proxy()

    def do_POST(self):
        self._proxy()

    def do_HEAD(self):
        self._proxy()

    def log_message(self, format, *args):
        print(f"[auth-proxy] {args[0]}", flush=True)


def main():
    print(f"[auth-proxy] Starting Scrapyd on port {SCRAPYD_PORT}...", flush=True)
    scrapyd_proc = start_scrapyd()

    print(f"[auth-proxy] Waiting for Scrapyd...", flush=True)
    wait_for_scrapyd()

    auth_status = "ENABLED" if API_KEY else "DISABLED (no SCRAPYD_API_KEY set)"
    print(f"[auth-proxy] Auth proxy listening on port {PROXY_PORT} (auth: {auth_status})", flush=True)

    server = HTTPServer(("0.0.0.0", PROXY_PORT), AuthProxyHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        scrapyd_proc.terminate()
        server.server_close()


if __name__ == "__main__":
    main()
