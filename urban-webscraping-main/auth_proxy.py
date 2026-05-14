"""Auth proxy for Scrapyd — validates X-API-Key header before forwarding requests.

This runs on $PORT (Railway) and proxies to Scrapyd on localhost:6800.
"""

import logging
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import URLError
from urllib.request import Request, urlopen

SCRAPYD_PORT = 6801
PROXY_PORT = int(os.environ.get("PORT", "8080"))
API_KEY = os.environ.get("SCRAPYD_API_KEY", "")
logger = logging.getLogger(__name__)


def start_scrapyd():
    """Start scrapyd as a subprocess."""
    proc = subprocess.Popen(
        [sys.executable, "-m", "scrapyd", "--pidfile="],
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    return proc


def cron_worker():
    """Executa os coletores diariamente em background."""
    while True:
        try:
            logger.info("[cron-worker] Iniciando bateria de coletores REST...")
            # Execute the shell script
            script_path = os.path.join(os.getcwd(), "scripts", "run_all_collectors.sh")
            subprocess.run(["bash", script_path], check=True)
            logger.info("[cron-worker] Bateria de coletores finalizada com sucesso.")
        except Exception as e:
            logger.exception("[cron-worker] Erro ao executar coletores: %s", e)

        # Dorme por 24 horas (86400 segundos)
        time.sleep(86400)


def wait_for_scrapyd(timeout=30):
    """Wait until scrapyd is ready."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            urlopen(f"http://127.0.0.1:{SCRAPYD_PORT}/daemonstatus.json")
            logger.info("[auth-proxy] Scrapyd is ready!")
            return True
        except (URLError, ConnectionError):
            time.sleep(0.5)
    logger.warning("[auth-proxy] Scrapyd did not start in time")
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
        logger.info("[auth-proxy] %s", format % args)


def main():
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
    logger.info("[auth-proxy] Starting Scrapyd on port %s...", SCRAPYD_PORT)
    scrapyd_proc = start_scrapyd()

    logger.info("[auth-proxy] Waiting for Scrapyd...")
    wait_for_scrapyd()

    auth_status = "ENABLED" if API_KEY else "DISABLED (no SCRAPYD_API_KEY set)"
    logger.info(
        "[auth-proxy] Auth proxy listening on port %s (auth: %s)",
        PROXY_PORT,
        auth_status,
    )

    # Inicia o cron-worker em background
    cron_thread = threading.Thread(target=cron_worker, daemon=True)
    cron_thread.start()
    logger.info("[auth-proxy] Cron worker started in background.")

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
