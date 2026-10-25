"""Cliente HTTP para o backend Urban AI (POST /events/ingest).

Usado pela UrbanIngestPipeline (Scrapy) e por todos os coletores
(`BaseCollector`) para enviar eventos ao backend pelo MESMO caminho de entrega.

Características:
  - Autentica somente com a API key escopada (`x-urban-events-ingest-key`).
    O login JWT por e-mail/senha foi removido: o backend não o aceita.
  - Fila SQLite persistente (`IngestOutbox`) quando `outbox_path` é informado
    (sempre em `from_env`): evento só sai da fila depois de confirmado pelo
    backend; falha final/crash não perde o lote.
  - Entrega pelo menos uma vez: timeout após gravação remota pode causar
    replay; o backend deduplica (dedupHash).
  - Valida a resposta (total/created/updated/skipped e resultado por evento);
    rejeições do backend vão para a quarentena com fonte e motivo.
  - Retry exponencial em rede/5xx/429 (HTTPAdapter) e backoff entre execuções
    na fila (30s, 60s ... 1h).

Variáveis de ambiente:
  URBAN_API_BASE              — ex: https://api.myurbanai.com (default localhost:10000)
  URBAN_EVENTS_INGEST_API_KEY — chave escopada para POST /events/ingest (obrigatória)
  URBAN_INGEST_OUTBOX_PATH    — arquivo SQLite; em produção, em volume persistente
  URBAN_INGEST_OUTBOX_MAX_EVENTS — teto de eventos pendentes (default 50000)
  URBAN_COLLECTOR_NAME / URBAN_COLLECTOR_VERSION / URBAN_INGEST_RUN_ID — auditoria
"""

from __future__ import annotations

import logging
import os
import sqlite3
from pathlib import Path
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from urban_webscrapping.utils.ingest_outbox import DEFAULT_MAX_PENDING, IngestOutbox

logger = logging.getLogger(__name__)
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_FORBIDDEN = 403
#: Rejeição permanente do lote/evento: reenviar o mesmo payload nunca resolve.
PERMANENT_REJECTION_STATUSES = frozenset({400, 413, 422})
SCRAPYD_DATA_DIR = Path("/var/lib/scrapyd")
LOCAL_OUTBOX_PATH = ".urban-ingest/outbox.sqlite3"
PRODUCTION_VALUES = frozenset({"production", "prod"})


def default_outbox_path() -> str:
    """Pasta de dados do Scrapyd quando existe (volume do Railway); senão local."""
    if SCRAPYD_DATA_DIR.is_dir():
        return str(SCRAPYD_DATA_DIR / "dbs" / "ingest-outbox.sqlite3")
    return LOCAL_OUTBOX_PATH


def is_production() -> bool:
    """True quando o processo roda em produção (Railway ou ENVIRONMENT=production)."""
    for name in (
        "ENVIRONMENT",
        "APP_ENV",
        "NODE_ENV",
        "RAILWAY_ENVIRONMENT",
        "RAILWAY_ENVIRONMENT_NAME",
    ):
        if (os.environ.get(name) or "").strip().lower() in PRODUCTION_VALUES:
            return True
    return False


class UrbanBackendError(Exception):
    """Erro genérico ao falar com o backend."""


class UrbanBackendRejected(UrbanBackendError):
    """O backend recusou o payload de forma permanente (HTTP 400/413/422)."""

    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def _merge_responses(parts: list[dict[str, Any]]) -> dict[str, Any]:
    """Soma respostas de sub-lotes numa resposta única no formato do backend."""
    merged: dict[str, Any] = {"total": 0, "created": 0, "updated": 0, "skipped": 0}
    results: list[Any] = []
    for part in parts:
        for key in ("total", "created", "updated", "skipped"):
            merged[key] += part.get(key, 0)
        results.extend(part.get("results") or [])
    merged["results"] = results
    return merged


class UrbanBackendClient:
    """Cliente leve para POST /events/ingest.

    Uso típico:

        client = UrbanBackendClient.from_env()
        client.add_event({"nome": "Show X", "dataInicio": "...", "source": "..."})
        client.close()  # drena a fila; o que falhar fica no outbox p/ a próxima run

    A mesma instância acumula até `batch_size` antes de enviar. Com outbox, o
    evento é gravado em disco no `add_event` e só removido após confirmação.
    """

    DEFAULT_BATCH_SIZE = 100
    DEFAULT_TIMEOUT = 30

    def __init__(  # noqa: PLR0913 - parâmetros opcionais de auditoria/outbox.
        self,
        api_base: str,
        batch_size: int = DEFAULT_BATCH_SIZE,
        timeout: int = DEFAULT_TIMEOUT,
        *,
        ingest_api_key: str | None = None,
        collector_name: str | None = None,
        collector_version: str | None = None,
        ingest_run_id: str | None = None,
        outbox_path: str | None = None,
        outbox_max_pending: int = DEFAULT_MAX_PENDING,
    ):
        self.api_base = api_base.rstrip("/")
        self.ingest_api_key = self._clean_optional(ingest_api_key)
        if not self.ingest_api_key:
            raise ValueError(
                "URBAN_EVENTS_INGEST_API_KEY obrigatoria para /events/ingest "
                "(o login por e-mail/senha foi removido)."
            )
        self.collector_name = self._clean_optional(collector_name)
        self.collector_version = self._clean_optional(collector_version)
        self.ingest_run_id = self._clean_optional(ingest_run_id)
        if (
            not isinstance(batch_size, int)
            or isinstance(batch_size, bool)
            or batch_size <= 0
        ):
            raise ValueError("batch_size deve ser inteiro positivo")
        self.batch_size = batch_size
        self.timeout = timeout

        self._buffer: list[dict[str, Any]] = []
        self._outbox = (
            IngestOutbox(outbox_path, self.api_base, max_pending=outbox_max_pending)
            if outbox_path
            else None
        )
        #: True quando o outbox pedido não pôde ser aberto (sem durabilidade).
        self.outbox_degraded = False
        #: Contadores desta instância (received = total confirmado pelo backend).
        self.stats: dict[str, int] = {
            "received": 0,
            "created": 0,
            "updated": 0,
            "rejected": 0,
            "failed_flushes": 0,
        }

        self._session = self._build_session()

    @classmethod
    def from_env(cls, batch_size: int = DEFAULT_BATCH_SIZE) -> UrbanBackendClient:
        """Constrói via env vars. Lança ValueError se faltar a API key."""
        api_base = os.environ.get("URBAN_API_BASE", "http://localhost:10000")
        ingest_api_key = cls._clean_optional(
            os.environ.get("URBAN_EVENTS_INGEST_API_KEY")
        )
        if not ingest_api_key:
            raise ValueError(
                "URBAN_EVENTS_INGEST_API_KEY obrigatoria para /events/ingest."
            )
        kwargs: dict[str, Any] = {
            "ingest_api_key": ingest_api_key,
            "collector_name": os.environ.get("URBAN_COLLECTOR_NAME"),
            "collector_version": os.environ.get("URBAN_COLLECTOR_VERSION"),
            "ingest_run_id": os.environ.get("URBAN_INGEST_RUN_ID"),
            "batch_size": batch_size,
        }
        max_pending = cls._int_env(
            "URBAN_INGEST_OUTBOX_MAX_EVENTS", DEFAULT_MAX_PENDING
        )
        outbox_path = (
            cls._clean_optional(os.environ.get("URBAN_INGEST_OUTBOX_PATH"))
            or default_outbox_path()
        )
        try:
            return cls(
                api_base,
                outbox_path=outbox_path,
                outbox_max_pending=max_pending,
                **kwargs,
            )
        except (OSError, sqlite3.Error) as exc:
            logger.error(
                "Outbox de ingestão indisponível em %s (%s): usando buffer em "
                "memória SEM durabilidade — falha de entrega perde o lote",
                outbox_path,
                exc,
            )
            client = cls(api_base, **kwargs)
            client.outbox_degraded = True
            return client

    @staticmethod
    def _int_env(name: str, default: int) -> int:
        raw = (os.environ.get(name) or "").strip()
        if not raw:
            return default
        try:
            value = int(raw)
        except ValueError:
            logger.warning("%s invalida (%r); usando %s", name, raw, default)
            return default
        return value if value > 0 else default

    def _build_session(self) -> requests.Session:
        s = requests.Session()
        retry = Retry(
            total=5,
            backoff_factor=1.5,  # 1.5s, 3s, 6s, 12s, 24s
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST", "GET"],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=4, pool_maxsize=8)
        s.mount("https://", adapter)
        s.mount("http://", adapter)
        return s

    @staticmethod
    def _clean_optional(value: str | None) -> str | None:
        text = (value or "").strip()
        return text or None

    # ========================== Buffer/flush ==========================

    def add_event(self, event: dict[str, Any]) -> None:
        """Enfileira um evento (em disco, se houver outbox). Auto-flush no lote."""
        if not event or not event.get("nome"):
            logger.debug("Ignorando evento sem o campo nome obrigatorio")
            return
        if self._outbox:
            try:
                self._outbox.enqueue(event)
            except (TypeError, ValueError) as exc:
                self.stats["rejected"] += 1
                # Só o tipo do erro: campos do evento podem carregar dado sensível.
                logger.error(
                    "Evento descartado por não ser serializável: %s",
                    type(exc).__name__,
                )
                return
        else:
            self._buffer.append(event)
        if self.buffer_size() >= self.batch_size:
            self.flush()

    def flush(self) -> dict[str, Any] | None:
        """Envia UM lote (até batch_size). Retorna a resposta validada do backend
        ou None se não houver nada elegível. Em falha, o lote permanece na fila.
        """
        if not self.buffer_size():
            return None

        owner = None
        if self._outbox:
            owner, events_to_send = self._outbox.claim(self.batch_size)
            if not events_to_send:
                return None
        else:
            events_to_send = self._buffer[: self.batch_size]

        try:
            result = self._deliver(events_to_send)
        except Exception as exc:
            self.stats["failed_flushes"] += 1
            if self._outbox and owner:
                self._outbox.release(owner, str(exc))
            if isinstance(exc, UrbanBackendError):
                raise
            # Erro inesperado (ex.: JSON inválido) não pode descartar o lote.
            raise UrbanBackendError(
                f"Ingest não confirmado; lote preservado ({type(exc).__name__})"
            ) from None

        if self._outbox and owner:
            try:
                self._outbox.acknowledge(owner, result.get("results"))
            except RuntimeError as exc:
                raise UrbanBackendError(
                    f"Lote será reenviado por perda de lease: {exc}"
                ) from exc
        else:
            self._buffer = self._buffer[len(events_to_send) :]
        self._record(events_to_send, result)
        return result

    def drain(self) -> dict[str, Any] | None:
        """Envia todos os lotes elegíveis. Propaga o primeiro erro de entrega."""
        parts: list[dict[str, Any]] = []
        while True:
            result = self.flush()
            if result is None:
                break
            parts.append(result)
        if not parts:
            return None
        merged = _merge_responses(parts)
        merged.pop("results", None)
        return merged

    def _deliver(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        """POST do lote; com outbox, isola o evento que o backend rejeita em
        definitivo (HTTP 400/413/422) por bisseção, sem travar os demais.
        """
        try:
            return self._post_ingest(events)
        except UrbanBackendRejected as exc:
            if not self._outbox:
                raise
            if len(events) == 1:
                reason = f"http_{exc.status_code}: {exc}"[:500]
                return {
                    "total": 1,
                    "created": 0,
                    "updated": 0,
                    "skipped": 1,
                    "results": [{"status": "skipped", "reason": reason}],
                }
            middle = len(events) // 2
            return _merge_responses(
                [self._deliver(events[:middle]), self._deliver(events[middle:])]
            )

    def _record(self, events: list[dict[str, Any]], data: dict[str, Any]) -> None:
        """Atualiza contadores e loga cada rejeição com fonte e motivo."""
        self.stats["received"] += data["total"]
        self.stats["created"] += data["created"]
        self.stats["updated"] += data["updated"]
        self.stats["rejected"] += data["skipped"]
        # Campos do evento ficam fora do log (podem carregar dado sensível);
        # com outbox, o evento inteiro fica na quarentena para revisão.
        for index, outcome in enumerate(data.get("results") or []):
            if isinstance(outcome, dict) and outcome.get("status") == "skipped":
                logger.warning(
                    "Ingest REJEITOU evento %d/%d do lote: reason=%s%s",
                    index + 1,
                    len(events),
                    str(outcome.get("reason") or "unspecified")[:200],
                    " (em quarentena)" if self._outbox else "",
                )

    def _post_ingest(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        url = f"{self.api_base}/events/ingest"
        try:
            resp = self._session.post(
                url,
                headers=self._ingest_headers(),
                json={"events": events},
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            raise UrbanBackendError(f"Erro de rede em /events/ingest: {e}") from e

        if resp.status_code in (HTTP_UNAUTHORIZED, HTTP_FORBIDDEN):
            raise UrbanBackendError(
                f"/events/ingest recusou a API key (HTTP {resp.status_code}); "
                "verifique URBAN_EVENTS_INGEST_API_KEY. Lote preservado."
            )
        if resp.status_code in PERMANENT_REJECTION_STATUSES:
            raise UrbanBackendRejected(
                f"/events/ingest falhou (HTTP {resp.status_code}): {resp.text[:300]}",
                resp.status_code,
            )
        if resp.status_code >= HTTP_BAD_REQUEST:
            raise UrbanBackendError(
                f"/events/ingest falhou (HTTP {resp.status_code}): {resp.text[:300]}"
            )

        try:
            data = resp.json()
        except ValueError as e:
            raise UrbanBackendError("Ingest retornou corpo que não é JSON") from e
        if not isinstance(data, dict):
            raise UrbanBackendError("Ingest retornou payload JSON invalido")
        self._validate_response(data, len(events))
        logger.info(
            "Ingest OK: total=%s created=%s updated=%s skipped=%s",
            data["total"],
            data["created"],
            data["updated"],
            data["skipped"],
        )
        return dict(data)

    @staticmethod
    def _validate_response(data: dict[str, Any], sent: int) -> None:
        """Só reconhece o lote se received/created/updated/rejected fecharem."""
        raw = [data.get(f) for f in ("total", "created", "updated", "skipped")]
        counts = [value for value in raw if type(value) is int and value >= 0]
        if len(counts) != len(raw) or counts[0] != sent or sum(counts[1:]) != counts[0]:
            raise UrbanBackendError(
                "Ingest retornou confirmação incompatível com o lote enviado"
            )
        outcomes = data.get("results")
        if outcomes is not None or data["skipped"]:
            if not isinstance(outcomes, list) or len(outcomes) != sent:
                raise UrbanBackendError(
                    "Ingest não detalhou o resultado de cada evento"
                )
            for status in ("created", "updated", "skipped"):
                matching = sum(
                    isinstance(item, dict) and item.get("status") == status
                    for item in outcomes
                )
                if matching != data[status]:
                    raise UrbanBackendError(
                        "Resultados individuais divergem das contagens de ingestão"
                    )

    def _ingest_headers(self) -> dict[str, str]:
        headers = {"x-urban-events-ingest-key": self.ingest_api_key or ""}
        if self.collector_name:
            headers["x-urban-collector"] = self.collector_name
        if self.collector_version:
            headers["x-urban-collector-version"] = self.collector_version
        if self.ingest_run_id:
            headers["x-urban-ingest-run-id"] = self.ingest_run_id
        return headers

    def buffer_size(self) -> int:
        """Eventos ainda não confirmados (fila em disco ou buffer em memória)."""
        return self._outbox.count() if self._outbox else len(self._buffer)

    def outbox_status(self) -> dict[str, int] | None:
        """Contagens da fila persistente (None sem outbox)."""
        return self._outbox.status() if self._outbox else None

    def close(self) -> None:
        """Drena a fila e fecha a conexão.

        Erros de entrega sobem como UrbanBackendError; os eventos não
        confirmados continuam no outbox (se houver) para a próxima execução.
        """
        try:
            self.drain()
        finally:
            self._session.close()
