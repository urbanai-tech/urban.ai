import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

import auth_proxy


def set_cron_state(**overrides):
    with auth_proxy.cron_state_lock:
        auth_proxy.cron_state.update(
            {
                "running": False,
                "runs": 0,
                "lastStartedAt": None,
                "lastFinishedAt": None,
                "lastDurationSeconds": None,
                "lastStatus": "never_run",
                "lastError": None,
                "nextRunAt": None,
                **overrides,
            }
        )


def test_health_payload_exposes_cron_status_without_secret(monkeypatch):
    monkeypatch.setattr(auth_proxy, "API_KEY", "super-secret-key")
    set_cron_state(
        runs=3,
        lastStatus="success",
        lastFinishedAt="2026-05-15T15:00:00Z",
        nextRunAt="2026-05-15T21:00:00Z",
    )

    payload = auth_proxy.build_health_payload(scrapyd_ready=True)
    serialized = json.dumps(payload)

    assert payload["status"] == "ok"
    assert payload["authConfigured"] is True
    assert payload["scrapyd"]["status"] == "ready"
    assert payload["collectorCron"]["runs"] == 3
    assert payload["collectorCron"]["lastStatus"] == "success"
    assert "super-secret-key" not in serialized


def test_health_payload_degrades_when_last_cron_failed():
    set_cron_state(lastStatus="failed", lastError="collector exploded")

    payload = auth_proxy.build_health_payload(scrapyd_ready=True)

    assert payload["status"] == "degraded"
    assert payload["collectorCron"]["lastError"] == "collector exploded"


def test_health_payload_degrades_when_scrapyd_unavailable():
    set_cron_state(lastStatus="success")

    payload = auth_proxy.build_health_payload(scrapyd_ready=False)

    assert payload["status"] == "degraded"
    assert payload["scrapyd"]["status"] == "unavailable"


def test_scrapyd_target_uses_loopback_allowlist_and_encoded_query():
    target = auth_proxy.build_scrapyd_target(
        "/schedule.json?project=urban+events&spider=ticket_master"
    )

    assert target == (
        "http://127.0.0.1:6801/schedule.json?project=urban+events&spider=ticket_master"
    )


@pytest.mark.parametrize(
    "target",
    [
        "https://attacker.example/schedule.json",
        "//attacker.example/schedule.json",
        "/unknown.json",
        "/schedule.json#fragment",
    ],
)
def test_scrapyd_target_rejects_non_allowlisted_destinations(target):
    with pytest.raises(ValueError):
        auth_proxy.build_scrapyd_target(target)


# --- Fail-closed auth -------------------------------------------------------


class _FakeScrapyd(BaseHTTPRequestHandler):
    hits: list[str] = []

    def _ok(self):
        _FakeScrapyd.hits.append(self.path)
        body = b'{"status": "ok"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = _ok
    do_POST = _ok

    def log_message(self, *args):
        pass


@pytest.fixture
def proxy_url(monkeypatch):
    """Sobe o proxy real em porta efemera apontando para um Scrapyd falso."""
    upstream = HTTPServer(("127.0.0.1", 0), _FakeScrapyd)
    proxy = HTTPServer(("127.0.0.1", 0), auth_proxy.AuthProxyHandler)
    _FakeScrapyd.hits = []
    monkeypatch.setattr(auth_proxy, "SCRAPYD_PORT", upstream.server_port)
    threads = [
        threading.Thread(target=s.serve_forever, daemon=True) for s in (upstream, proxy)
    ]
    for t in threads:
        t.start()
    yield f"http://127.0.0.1:{proxy.server_port}"
    for s in (upstream, proxy):
        s.shutdown()
        s.server_close()


def _call(url, path, method="GET", key=None):
    req = Request(url + path, method=method, data=b"" if method == "POST" else None)
    if key is not None:
        req.add_header("X-API-Key", key)
    try:
        with urlopen(req, timeout=5) as resp:
            return resp.status
    except HTTPError as e:
        return e.code


def test_is_authorized_uses_constant_time_comparison(monkeypatch):
    monkeypatch.setattr(auth_proxy, "API_KEY", "super-secret-key")
    monkeypatch.setattr(auth_proxy, "ALLOW_INSECURE_NO_AUTH", False)
    calls = []
    real = auth_proxy.hmac.compare_digest
    monkeypatch.setattr(
        auth_proxy.hmac,
        "compare_digest",
        lambda a, b: calls.append((a, b)) or real(a, b),
    )

    assert auth_proxy.is_authorized("super-secret-key") is True
    assert auth_proxy.is_authorized("wrong") is False
    assert auth_proxy.is_authorized("") is False
    assert auth_proxy.is_authorized("chave-com-acento-é") is False
    assert len(calls) == 4


def test_missing_key_rejects_everything_except_health(monkeypatch, proxy_url):
    monkeypatch.setattr(auth_proxy, "API_KEY", "")
    monkeypatch.setattr(auth_proxy, "ALLOW_INSECURE_NO_AUTH", False)

    assert _call(proxy_url, "/addversion.json", "POST") == 503
    assert _call(proxy_url, "/schedule.json", "POST", key="anything") == 503
    assert _call(proxy_url, "/listjobs.json") == 503
    assert _FakeScrapyd.hits == []
    # health continua respondendo (200 ou 503 por degradacao), nunca via proxy
    assert _call(proxy_url, "/health") in (200, 503)


def test_configured_key_is_enforced(monkeypatch, proxy_url):
    monkeypatch.setattr(auth_proxy, "API_KEY", "super-secret-key")
    monkeypatch.setattr(auth_proxy, "ALLOW_INSECURE_NO_AUTH", False)

    assert _call(proxy_url, "/addversion.json", "POST") == 401
    assert _call(proxy_url, "/addversion.json", "POST", key="wrong") == 401
    assert _FakeScrapyd.hits == []
    assert _call(proxy_url, "/listjobs.json", key="super-secret-key") == 200
    assert _FakeScrapyd.hits == ["/listjobs.json"]


def test_explicit_local_dev_flag_allows_no_key(monkeypatch, proxy_url):
    monkeypatch.setattr(auth_proxy, "API_KEY", "")
    monkeypatch.setattr(auth_proxy, "ALLOW_INSECURE_NO_AUTH", True)

    assert _call(proxy_url, "/listjobs.json") == 200


def test_main_refuses_to_start_without_key(monkeypatch):
    monkeypatch.setattr(auth_proxy, "API_KEY", "")
    monkeypatch.setattr(auth_proxy, "ALLOW_INSECURE_NO_AUTH", False)
    started = []
    monkeypatch.setattr(auth_proxy, "start_scrapyd", lambda: started.append(1))

    with pytest.raises(SystemExit) as exc:
        auth_proxy.main()

    assert exc.value.code == 1
    assert started == []
