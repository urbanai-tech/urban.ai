"""Validate Prefect parameters and Scrapyd acknowledgements without network calls."""

import importlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def flow_module(monkeypatch, tmp_path):
    """Do not load a workspace .env while testing the deployment contract."""
    monkeypatch.chdir(tmp_path)
    return importlib.import_module("spiders_pipeline.main")


def test_optional_scrapyd_parameter_passes_prefect_validation(flow_module):
    """The actual Prefect model must accept the deployed omitted/null argument."""
    assert (
        flow_module.trigger_all_spiders.validate_parameters({"scrapyd_url": None})[
            "scrapyd_url"
        ]
        is None
    )
    assert (
        flow_module.trigger_all_spiders.validate_parameters({})["scrapyd_url"] is None
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("explicit", [None, "https://scrapyd.example.invalid"])
async def test_trigger_flow_resolves_omitted_and_explicit_url(flow_module, explicit):
    """Valid settings reach scheduling; no Prefect API or Scrapyd is contacted."""
    with (
        patch.object(flow_module, "get_run_logger", return_value=MagicMock()),
        patch.object(
            flow_module.Variable,
            "aget",
            new=AsyncMock(
                return_value={"WEBSCRAPPING_API_URL": "https://scrapyd.example.invalid"}
            ),
        ) as variable,
        patch.object(flow_module, "check_service_task", return_value=True),
        patch.object(flow_module, "SpiderTriggers") as spiders,
    ):
        await flow_module.trigger_all_spiders.fn(explicit)
        spiders.return_value.crawl_eventim.assert_called_once()
        spiders.return_value.crawl_ticket_360.assert_called_once()
        assert variable.await_count == (1 if explicit is None else 0)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "variable_value",
    [None, {}, {"WEBSCRAPPING_API_URL": None}, {"WEBSCRAPPING_API_URL": ""}],
)
async def test_invalid_provider_configuration_fails_the_flow(
    flow_module, variable_value
):
    """Missing configuration is not a successful zero-work deployment run."""
    with (
        patch.object(flow_module, "get_run_logger", return_value=MagicMock()),
        patch.object(
            flow_module.Variable, "aget", new=AsyncMock(return_value=variable_value)
        ),
        patch.object(flow_module, "SpiderTriggers") as spiders,
    ):
        with pytest.raises(ValueError):
            await flow_module.trigger_all_spiders.fn()
        spiders.assert_not_called()


def test_unavailable_service_raises_so_prefect_can_retry(flow_module):
    """False health response must become a failed task with retry semantics."""
    with (
        patch.object(flow_module, "get_run_logger", return_value=MagicMock()),
        patch.object(flow_module, "check_scrapyd_service", return_value=False),
    ):
        with pytest.raises(RuntimeError, match="not available"):
            flow_module.check_service_task.fn("https://scrapyd.example.invalid")


@pytest.mark.parametrize(
    "payload",
    [{"status": "error"}, {"status": "ok"}, [], {"status": "ok", "jobid": ""}],
)
def test_http_success_without_scrapyd_job_acknowledgement_is_not_success(
    flow_module, payload
):
    """An HTTP 200 without status=ok and jobid must not create a false success."""
    module = importlib.import_module(
        "spiders_pipeline.spiders_triggers.spiders_triggers"
    )
    with (
        patch.object(module, "get_run_logger", return_value=MagicMock()),
        patch.object(module.httpx, "post") as post,
    ):
        post.return_value.json.return_value = payload
        with pytest.raises(RuntimeError, match="did not confirm"):
            module.SpiderTriggers("https://scrapyd.example.invalid")._trigger_spider(
                "eventim"
            )
