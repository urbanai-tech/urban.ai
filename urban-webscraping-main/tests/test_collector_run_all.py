from urban_webscrapping.collectors.base_collector import CollectorRunResult
from urban_webscrapping.collectors.run_all import (
    CollectorSpec,
    _aggregate_status,
    run_collector,
    schedule_legacy_spiders,
)


def test_optional_collector_sem_key_vira_skipped_missing_key(monkeypatch):
    monkeypatch.delenv("SERPAPI_KEY", raising=False)
    spec = CollectorSpec(
        "serpapi-events",
        "urban_webscrapping.collectors.serpapi_events",
        "SerpApiEventsCollector",
        critical=False,
        required_env=("SERPAPI_KEY",),
    )

    result = run_collector(spec, dry_run=True)

    assert result.status == "skipped"
    assert result.skip_reason == "missing_key"
    assert "SERPAPI_KEY" in result.errors[0]


def test_aggregate_falha_quando_fonte_critica_falha():
    critical = CollectorSpec("sp-cultura", "unused", "Unused", critical=True)
    optional = CollectorSpec("serpapi-events", "unused", "Unused", critical=False)
    results = [
        (optional, CollectorRunResult(source="serpapi-events", status="skipped", skip_reason="missing_key")),
        (critical, CollectorRunResult(source="sp-cultura", status="failed", errors=["network down"])),
    ]

    assert _aggregate_status(results) == "failed"


def test_aggregate_degraded_quando_opcional_com_key_falha():
    optional = CollectorSpec("serpapi-events", "unused", "Unused", critical=False)
    results = [
        (optional, CollectorRunResult(source="serpapi-events", status="failed", errors=["http 500"])),
    ]

    assert _aggregate_status(results) == "degraded"


def test_legacy_spiders_skipped_em_dry_run():
    result = schedule_legacy_spiders(dry_run=True)

    assert result.status == "skipped"
    assert result.skip_reason == "dry_run"
