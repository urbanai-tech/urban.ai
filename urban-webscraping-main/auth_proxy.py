"""Auth proxy for Scrapyd — validates X-API-Key header before forwarding requests.

This runs on $PORT (Railway) and proxies to Scrapyd on localhost:6800.
"""

import json
import logging
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SCRAPYD_PORT = 6801
PROXY_PORT = int(os.environ.get("PORT", "8080"))
API_KEY = os.environ.get("SCRAPYD_API_KEY", "")
COLLECTOR_CRON_INTERVAL_SECONDS = int(os.environ.get("COLLECTOR_CRON_INTERVAL_SECONDS", "21600"))
RUN_COLLECTORS_ON_BOOT = os.environ.get("RUN_COLLECTORS_ON_BOOT", "true").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
logger = logging.getLogger(__name__)
cron_state_lock = threading.Lock()
cron_state = {
    "running": False,
    "runs": 0,
    "lastStartedAt": None,
    "lastFinishedAt": None,
    "lastDurationSeconds": None,
    "lastStatus": "never_run",
    "lastError": None,
    "nextRunAt": None,
}


def utc_iso(ts: float | None = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts or time.time()))


def set_next_run(delay_seconds: int) -> None:
    with cron_state_lock:
        cron_state["nextRunAt"] = utc_iso(time.time() + delay_seconds)


def build_health_payload(scrapyd_ready: bool | None = None) -> dict:
    with cron_state_lock:
        state = dict(cron_state)

    scrapyd_status = "unknown"
    if scrapyd_ready is not None:
        scrapyd_status = "ready" if scrapyd_ready else "unavailable"

    degraded = scrapyd_ready is False or state["lastStatus"] == "failed"

    return {
        "status": "degraded" if degraded else "ok",
        "service": "urban-webscraping",
        "generatedAt": utc_iso(),
        "authConfigured": bool(API_KEY),
        "scrapyd": {"status": scrapyd_status},
        "collectorCron": {
            "enabled": True,
            "intervalSeconds": COLLECTOR_CRON_INTERVAL_SECONDS,
            "runOnBoot": RUN_COLLECTORS_ON_BOOT,
            **state,
        },
    }


def start_scrapyd():
    """Start scrapyd as a subprocess."""
    proc = subprocess.Popen(
        [sys.executable, "-m", "scrapyd", "--pidfile="],
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    return proc


def cron_worker():
    """Executa os coletores periodicamente em background."""
    if not RUN_COLLECTORS_ON_BOOT:
        set_next_run(COLLECTOR_CRON_INTERVAL_SECONDS)
        logger.info(
            "[cron-worker] Initial run disabled; sleeping %s seconds before first collectors run.",
            COLLECTOR_CRON_INTERVAL_SECONDS,
        )
        time.sleep(COLLECTOR_CRON_INTERVAL_SECONDS)

    while True:
        started = time.time()
        with cron_state_lock:
            cron_state.update(
                {
                    "running": True,
                    "lastStartedAt": utc_iso(started),
                    "lastFinishedAt": None,
                    "lastDurationSeconds": None,
                    "lastStatus": "running",
                    "lastError": None,
                    "nextRunAt": None,
                }
            )
        try:
            logger.info("[cron-worker] Iniciando bateria de coletores REST...")
            subprocess.run(
                [sys.executable, "-m", "urban_webscrapping.collectors.run_all"],
                check=True,
            )
            finished = time.time()
            with cron_state_lock:
                cron_state.update(
                    {
                        "running": False,
                        "runs": int(cron_state["runs"]) + 1,
                        "lastFinishedAt": utc_iso(finished),
                        "lastDurationSeconds": round(finished - started, 3),
                        "lastStatus": "success",
                        "lastError": None,
                    }
                )
            logger.info("[cron-worker] Bateria de coletores finalizada com sucesso.")
        except Exception as e:
            finished = time.time()
            with cron_state_lock:
                cron_state.update(
                    {
                        "running": False,
                        "runs": int(cron_state["runs"]) + 1,
                        "lastFinishedAt": utc_iso(finished),
                        "lastDurationSeconds": round(finished - started, 3),
                        "lastStatus": "failed",
                        "lastError": str(e),
                    }
                )
            logger.exception("[cron-worker] Erro ao executar coletores: %s", e)

        set_next_run(COLLECTOR_CRON_INTERVAL_SECONDS)
        logger.info(
            "[cron-worker] Proxima bateria de coletores em %s segundos.",
            COLLECTOR_CRON_INTERVAL_SECONDS,
        )
        time.sleep(COLLECTOR_CRON_INTERVAL_SECONDS)


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


def check_scrapyd_ready(timeout=2) -> bool:
    try:
        urlopen(f"http://127.0.0.1:{SCRAPYD_PORT}/daemonstatus.json", timeout=timeout)
        return True
    except (URLError, TimeoutError, ConnectionError):
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

    def _send_json(self, payload: dict, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_health(self):
        payload = build_health_payload(scrapyd_ready=check_scrapyd_ready())
        status = 200 if payload["status"] == "ok" else 503
        self._send_json(payload, status=status)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in {"/health", "/health.json", "/health/live", "/cron-status.json"}:
            self._handle_health()
            return
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
    logger.info(
        "[auth-proxy] Cron worker started in background (interval=%ss run_on_boot=%s).",
        COLLECTOR_CRON_INTERVAL_SECONDS,
        RUN_COLLECTORS_ON_BOOT,
    )

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
