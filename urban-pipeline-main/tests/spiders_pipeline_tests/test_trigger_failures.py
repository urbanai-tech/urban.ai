"""Garante que o flow de disparo dos spiders FALHA quando deve.

O flow não pode terminar "Completed" quando o Scrapyd está fora do ar, não
agendou nada ou a config está errada.
"""

import asyncio
from unittest.mock import MagicMock

import httpx
import pytest

from spiders_pipeline import main as flow_module
from spiders_pipeline.spiders_triggers import spiders_triggers
from spiders_pipeline.utils.check_service import check_scrapyd_service


def _response(status_code=200, payload=None, bad_json=False):
    resp = MagicMock()
    resp.status_code = status_code
    if bad_json:
        resp.json.side_effect = ValueError("not json")
    else:
        resp.json.return_value = payload if payload is not None else {}
    resp.raise_for_status.side_effect = (
        None
        if status_code < 400
        else httpx.HTTPStatusError("err", request=MagicMock(), response=resp)
    )
    return resp


@pytest.fixture(autouse=True)
def plain_python(monkeypatch):
    """Roda flow/tasks como funções Python puras (sem servidor Prefect)."""
    logger = MagicMock()
    monkeypatch.setattr(flow_module, "get_run_logger", lambda: logger)
    monkeypatch.setattr(spiders_triggers, "get_run_logger", lambda: logger)
    monkeypatch.setattr(
        flow_module, "check_service_task", flow_module.check_service_task.fn
    )
    for name in dir(spiders_triggers.SpiderTriggers):
        if name.startswith("crawl_"):
            task = getattr(spiders_triggers.SpiderTriggers, name)
            monkeypatch.setattr(spiders_triggers.SpiderTriggers, name, task.fn)


def run_flow(url="http://scrapyd.test"):
    """Executa o flow de disparo como função Python pura."""
    return asyncio.run(flow_module.trigger_all_spiders.fn(scrapyd_url=url))


# --- check_scrapyd_service -------------------------------------------------


def test_check_service_envia_api_key_e_aceita_status_ok(monkeypatch):
    """Check service envia api key e aceita status ok."""
    get = MagicMock(return_value=_response(200, {"status": "ok"}))
    monkeypatch.setattr(httpx, "get", get)
    assert check_scrapyd_service("http://x", api_key="k") is True
    assert get.call_args.kwargs["headers"] == {"X-API-Key": "k"}
    assert get.call_args.kwargs["timeout"]


@pytest.mark.parametrize(
    "resp",
    [
        _response(401, {"status": "error"}),
        _response(200, {"status": "error"}),
        _response(502, bad_json=True),
        _response(200, bad_json=True),
    ],
)
def test_check_service_false_em_resposta_ruim(monkeypatch, resp):
    """Check service false em resposta ruim."""
    monkeypatch.setattr(httpx, "get", MagicMock(return_value=resp))
    assert check_scrapyd_service("http://x", api_key="k") is False


def test_check_service_false_quando_inalcancavel(monkeypatch):
    """Check service false quando inalcancavel."""
    monkeypatch.setattr(httpx, "get", MagicMock(side_effect=httpx.ConnectError("down")))
    assert check_scrapyd_service("http://x") is False


# --- flow ------------------------------------------------------------------


def test_flow_falha_quando_scrapyd_inalcancavel(monkeypatch):
    """Flow falha quando scrapyd inalcancavel."""
    monkeypatch.setattr(flow_module, "check_scrapyd_service", lambda **_: False)
    post = MagicMock()
    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(RuntimeError, match="not available"):
        run_flow()
    post.assert_not_called()


def test_flow_falha_quando_nenhum_job_agendado(monkeypatch):
    """Flow falha quando nenhum job agendado."""
    monkeypatch.setattr(flow_module, "check_scrapyd_service", lambda **_: True)
    monkeypatch.setattr(
        httpx, "post", MagicMock(return_value=_response(200, {"status": "error"}))
    )
    with pytest.raises(RuntimeError, match="7/7 spiders"):
        run_flow()


def test_flow_tenta_todos_e_falha_se_algum_falhar(monkeypatch):
    """Flow tenta todos e falha se algum falhar."""
    monkeypatch.setattr(flow_module, "check_scrapyd_service", lambda **_: True)

    def post(url, data=None, **_):
        if data["spider"] == "sympla":
            return _response(500, {})
        return _response(200, {"status": "ok", "jobid": "j-" + data["spider"]})

    mock_post = MagicMock(side_effect=post)
    monkeypatch.setattr(httpx, "post", mock_post)
    with pytest.raises(RuntimeError, match="1/7 spiders.*sympla"):
        run_flow()
    assert mock_post.call_count == 7  # os demais spiders ainda foram agendados


def test_flow_completa_quando_tudo_agenda(monkeypatch):
    """Flow completa quando tudo agenda."""
    monkeypatch.setattr(flow_module, "check_scrapyd_service", lambda **_: True)
    mock_post = MagicMock(return_value=_response(200, {"status": "ok", "jobid": "abc"}))
    monkeypatch.setattr(httpx, "post", mock_post)
    run_flow()
    assert mock_post.call_count == 7


def test_flow_falha_sem_url_configurada(monkeypatch):
    """Flow falha sem url configurada."""

    async def fake_aget(_name):
        return None

    monkeypatch.setattr(flow_module.Variable, "aget", fake_aget)
    with pytest.raises(RuntimeError, match="not configured"):
        asyncio.run(flow_module.trigger_all_spiders.fn())
