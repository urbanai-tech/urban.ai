"""Runner agregado dos coletores de eventos Urban AI.

O objetivo operacional deste modulo e impedir "sucesso falso": cada fonte
gera um status proprio, fontes opcionais sem chave viram skipped/missing_key,
e falhas em fontes criticas retornam exit code != 0 para o cron/scheduler.
"""

from __future__ import annotations

import importlib
import json
import logging
import os
import time
from dataclasses import asdict, dataclass
from typing import Any

import requests
from dotenv import load_dotenv

from urban_webscrapping.collectors.base_collector import (
    BaseCollector,
    CollectorRunResult,
    setup_logging,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CollectorSpec:
    """Configuracao operacional de uma fonte coletora."""

    name: str
    module: str
    class_name: str
    critical: bool = True
    required_env: tuple[str, ...] = ()


REST_COLLECTORS: tuple[CollectorSpec, ...] = (
    # Camada 1 - APIs oficiais e fontes publicas.
    CollectorSpec(
        "api-football",
        "urban_webscrapping.collectors.api_football",
        "ApiFootballCollector",
        critical=False,
        required_env=("API_FOOTBALL_KEY",),
    ),
    CollectorSpec(
        "sp-cultura",
        "urban_webscrapping.collectors.sp_cultura",
        "SpCulturaCollector",
        critical=False,
    ),
    CollectorSpec(
        "usp-eventos",
        "urban_webscrapping.collectors.usp_eventos",
        "UspEventosCollector",
        critical=False,
    ),
    CollectorSpec(
        "marcha-para-jesus",
        "urban_webscrapping.collectors.marcha_para_jesus",
        "MarchaParaJesusCollector",
        critical=False,
    ),
    # Camada 1 - venues conhecidos, scraping HTML simples sem credencial.
    CollectorSpec(
        "allianz-parque",
        "urban_webscrapping.collectors.allianz_parque",
        "AllianzParqueCollector",
        critical=False,
    ),
    CollectorSpec(
        "anhembi",
        "urban_webscrapping.collectors.anhembi",
        "AnhembiCollector",
        critical=False,
    ),
    CollectorSpec(
        "sao-paulo-expo",
        "urban_webscrapping.collectors.sao_paulo_expo",
        "SaoPauloExpoCollector",
        critical=False,
    ),
    CollectorSpec(
        "expo-center-norte",
        "urban_webscrapping.collectors.expo_center_norte",
        "ExpoCenterNorteCollector",
        critical=False,
    ),
    CollectorSpec(
        "transamerica-expo",
        "urban_webscrapping.collectors.transamerica_expo",
        "TransamericaExpoCollector",
        critical=False,
    ),
    CollectorSpec(
        "vibra-sao-paulo",
        "urban_webscrapping.collectors.vibra_sao_paulo",
        "VibraSaoPauloCollector",
        critical=False,
    ),
    CollectorSpec(
        "tokio-marine-hall",
        "urban_webscrapping.collectors.tokio_marine_hall",
        "TokioMarineHallCollector",
        critical=False,
    ),
    CollectorSpec(
        "espaco-unimed",
        "urban_webscrapping.collectors.espaco_unimed",
        "EspacoUnimedCollector",
        critical=False,
    ),
    CollectorSpec(
        "wtc-sao-paulo",
        "urban_webscrapping.collectors.wtc_sao_paulo",
        "WtcSaoPauloCollector",
        critical=False,
    ),
    # Camada 2 - busca/LLM. Opcionais porque dependem de chaves pagas.
    CollectorSpec(
        "serpapi-events",
        "urban_webscrapping.collectors.serpapi_events",
        "SerpApiEventsCollector",
        critical=False,
        required_env=("SERPAPI_KEY",),
    ),
    CollectorSpec(
        "tavily",
        "urban_webscrapping.collectors.tavily_search",
        "TavilySearchCollector",
        critical=False,
        required_env=("TAVILY_API_KEY", "GEMINI_API_KEY"),
    ),
    CollectorSpec(
        "firecrawl",
        "urban_webscrapping.collectors.firecrawl_extractor",
        "FirecrawlExtractor",
        critical=False,
        required_env=("FIRECRAWL_API_KEY", "GEMINI_API_KEY"),
    ),
)


LEGACY_SPIDERS: tuple[str, ...] = (
    "blue_ticket",
    "even3",
    "eventim",
    "ingresse",
    "sympla",
    "ticket_360",
    "ticket_master",
)


def _env_enabled(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _missing_env(names: tuple[str, ...]) -> list[str]:
    return [name for name in names if not os.environ.get(name)]


def _skipped_result(source: str, reason: str, detail: str) -> CollectorRunResult:
    return CollectorRunResult(
        source=source,
        status="skipped",
        skip_reason=reason,
        errors=[detail],
    )


def run_collector(spec: CollectorSpec, dry_run: bool) -> CollectorRunResult:
    """Executa um coletor REST e devolve status estruturado."""
    missing = _missing_env(spec.required_env)
    if missing:
        detail = f"missing required env: {', '.join(missing)}"
        logger.warning("[%s] skipped: missing_key (%s)", spec.name, ", ".join(missing))
        return _skipped_result(spec.name, "missing_key", detail)

    try:
        module = importlib.import_module(spec.module)
        collector_class = getattr(module, spec.class_name)
        collector: BaseCollector = collector_class(dry_run=dry_run)
    except Exception as exc:
        logger.exception("[%s] initialization failed", spec.name)
        return CollectorRunResult(
            source=spec.name,
            status="failed",
            errors=[f"initialization: {exc}"],
        )

    return collector.run()


def schedule_legacy_spiders(dry_run: bool) -> CollectorRunResult:
    """Agenda spiders legados no Scrapyd com status agregado."""
    result = CollectorRunResult(source="legacy-scrapyd-spiders")

    if not _env_enabled("RUN_LEGACY_SPIDERS", True):
        result.status = "skipped"
        result.skip_reason = "disabled"
        return result

    if dry_run:
        result.status = "skipped"
        result.skip_reason = "dry_run"
        return result

    scrapyd_url = os.environ.get("SCRAPYD_URL", "http://127.0.0.1:6801").rstrip("/")
    project = os.environ.get("SCRAPYD_PROJECT", "urban_webscrapping")
    start = time.time()

    for spider in LEGACY_SPIDERS:
        try:
            response = requests.post(
                f"{scrapyd_url}/schedule.json",
                data={"project": project, "spider": spider},
                timeout=15,
            )
            response.raise_for_status()
            payload: dict[str, Any] = response.json()
            if payload.get("status") != "ok":
                raise RuntimeError(f"Scrapyd returned {payload}")
            result.sent += 1
            logger.info("[legacy-spiders] scheduled %s job=%s", spider, payload.get("jobid"))
        except Exception as exc:
            logger.error("[legacy-spiders] failed to schedule %s: %s", spider, exc)
            result.errors.append(f"{spider}: {exc}")

    result.fetched = len(LEGACY_SPIDERS)
    result.normalized = result.sent
    result.elapsed_seconds = round(time.time() - start, 2)
    if result.errors and result.sent:
        result.status = "partial_failure"
    elif result.errors:
        result.status = "failed"
    else:
        result.status = "success"
    return result


def _aggregate_status(results: list[tuple[CollectorSpec | None, CollectorRunResult]]) -> str:
    has_optional_failure = False
    has_warning = False

    for spec, result in results:
        critical = True if spec is None else spec.critical
        if critical and result.status in {"failed", "partial_failure"}:
            return "failed"
        if critical and result.status == "no_data":
            has_warning = True
        if not critical and result.status in {"failed", "partial_failure"}:
            has_optional_failure = True

    if has_optional_failure or has_warning:
        return "degraded"
    return "success"


def _print_summary(results: list[tuple[CollectorSpec | None, CollectorRunResult]], aggregate_status: str) -> None:
    print("\nCollector run summary:")  # noqa: T201
    print("source,status,critical,fetched,normalized,sent,skip_reason,errors")  # noqa: T201
    for spec, result in results:
        critical = True if spec is None else spec.critical
        print(  # noqa: T201
            f"{result.source},{result.status},{str(critical).lower()},"
            f"{result.fetched},{result.normalized},{result.sent},"
            f"{result.skip_reason or ''},{len(result.errors)}"
        )

    machine_summary = {
        "aggregate_status": aggregate_status,
        "results": [
            {
                "critical": True if spec is None else spec.critical,
                **asdict(result),
            }
            for spec, result in results
        ],
    }
    print(  # noqa: T201
        "COLLECTOR_RUN_SUMMARY="
        + json.dumps(machine_summary, ensure_ascii=False, sort_keys=True)
    )


def main() -> int:
    """Executa todos os coletores e retorna exit code operacional."""
    load_dotenv()
    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))

    dry_run = _env_enabled("DRY_RUN", False)
    if not dry_run:
        missing_backend_env = _missing_env(("URBAN_COLLECTOR_EMAIL", "URBAN_COLLECTOR_PASSWORD"))
        if missing_backend_env:
            logger.error(
                "Backend ingest credentials missing: %s. Use DRY_RUN=true for local diagnostics.",
                ", ".join(missing_backend_env),
            )
            result = CollectorRunResult(
                source="backend-ingest-config",
                status="failed",
                errors=[f"missing required env: {', '.join(missing_backend_env)}"],
            )
            _print_summary([(None, result)], "failed")
            return 1

    results: list[tuple[CollectorSpec | None, CollectorRunResult]] = []
    for spec in REST_COLLECTORS:
        logger.info("[%s] starting (critical=%s dry_run=%s)", spec.name, spec.critical, dry_run)
        results.append((spec, run_collector(spec, dry_run=dry_run)))

    results.append((None, schedule_legacy_spiders(dry_run=dry_run)))

    aggregate_status = _aggregate_status(results)
    _print_summary(results, aggregate_status)
    return 1 if aggregate_status == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
