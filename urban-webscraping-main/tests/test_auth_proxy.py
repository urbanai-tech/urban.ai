import json

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
