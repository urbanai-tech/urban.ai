"""Cliente HTTP para o backend Urban AI (POST /events/ingest).

Usado pelo IngestPipeline (Scrapy) e pelos coletores de API (api-football,
Sympla API, Eventbrite, Firecrawl) pra enviar eventos ao backend de forma
unificada e dedupada.

Características:
  - Preferencialmente usa API key escopada para /events/ingest
  - Mantém login legado com email/senha de admin "técnico" quando necessário
  - Buffer interno de eventos: bufferiza até `batch_size` antes de enviar
    (default 100), reduz overhead HTTP
  - Retry exponencial em erro de rede / 5xx / 429
  - from_env usa fila SQLite: eventos não confirmados sobrevivem a reinícios
    quando o arquivo está em armazenamento persistente.
  - Entrega pelo menos uma vez: timeout após gravação remota pode causar replay;
    o backend continua responsável pela deduplicação.

Variáveis de ambiente esperadas:
  URBAN_API_BASE       — ex: https://api.myurbanai.com (default localhost:10000)
  URBAN_EVENTS_INGEST_API_KEY — chave escopada para POST /events/ingest
  URBAN_COLLECTOR_EMAIL — login legado do user admin técnico
  URBAN_COLLECTOR_PASSWORD — senha legada
  URBAN_INGEST_OUTBOX_PATH — arquivo SQLite em volume persistente na produção
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from urban_webscrapping.utils.ingest_outbox import IngestOutbox

logger = logging.getLogger(__name__)
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401


class UrbanBackendError(Exception):
    """Erro genérico ao falar com o backend."""


class UrbanBackendClient:
    """Cliente leve para POST /events/ingest.

    Uso típico (dentro de uma Scrapy pipeline):

        client = UrbanBackendClient.from_env()
        client.add_event({
            "nome": "Show X",
            "dataInicio": "2026-05-10T20:00:00Z",
            "enderecoCompleto": "Allianz Parque - SP",
            "source": "scraper-sympla",
            ...
        })
        client.flush()  # envia o que está no buffer

    Reuso entre items: a mesma instância acumula até `batch_size` antes
    de enviar pro backend.
    """

    DEFAULT_BATCH_SIZE = 100
    DEFAULT_TIMEOUT = 30
    TOKEN_LIFETIME_SAFE_SECONDS = 12 * 60  # 12 min, pra dar margem dos 15min do JWT

    def __init__(  # noqa: PLR0913 - preserva compatibilidade legada e aceita headers opcionais.
        self,
        api_base: str,
        email: str | None = None,
        password: str | None = None,
        batch_size: int = DEFAULT_BATCH_SIZE,
        timeout: int = DEFAULT_TIMEOUT,
        *,
        ingest_api_key: str | None = None,
        collector_name: str | None = None,
        collector_version: str | None = None,
        ingest_run_id: str | None = None,
        outbox_path: str | None = None,
    ):
        self.api_base = api_base.rstrip("/")
        self.email = email
        self.password = password
        self.ingest_api_key = self._clean_optional(ingest_api_key)
        self.collector_name = self._clean_optional(collector_name)
        self.collector_version = self._clean_optional(collector_version)
        self.ingest_run_id = self._clean_optional(ingest_run_id)
        self.batch_size = batch_size
        self.timeout = timeout

        self._token: str | None = None
        self._token_acquired_at: float = 0.0

        self._buffer: list[dict[str, Any]] = []
        if (
            not isinstance(batch_size, int)
            or isinstance(batch_size, bool)
            or batch_size <= 0
        ):
            raise ValueError("batch_size deve ser inteiro positivo")
        self._outbox = IngestOutbox(outbox_path, self.api_base) if outbox_path else None

        self._session = self._build_session()

    @classmethod
    def from_env(cls, batch_size: int = DEFAULT_BATCH_SIZE) -> UrbanBackendClient:
        """Constrói via env vars. Lança ValueError se faltar configuração."""
        api_base = os.environ.get("URBAN_API_BASE", "http://localhost:10000")
        ingest_api_key = cls._clean_optional(
            os.environ.get("URBAN_EVENTS_INGEST_API_KEY")
        )
        collector_name = cls._clean_optional(os.environ.get("URBAN_COLLECTOR_NAME"))
        collector_version = cls._clean_optional(
            os.environ.get("URBAN_COLLECTOR_VERSION")
        )
        ingest_run_id = cls._clean_optional(os.environ.get("URBAN_INGEST_RUN_ID"))
        email = os.environ.get("URBAN_COLLECTOR_EMAIL")
        password = os.environ.get("URBAN_COLLECTOR_PASSWORD")
        if not ingest_api_key and (not email or not password):
            raise ValueError(
                "URBAN_EVENTS_INGEST_API_KEY obrigatoria para /events/ingest. "
                "Compatibilidade legada: setar URBAN_COLLECTOR_EMAIL e "
                "URBAN_COLLECTOR_PASSWORD para autenticar via JWT admin."
            )
        return cls(
            api_base=api_base,
            email=email,
            password=password,
            ingest_api_key=ingest_api_key,
            collector_name=collector_name,
            collector_version=collector_version,
            ingest_run_id=ingest_run_id,
            batch_size=batch_size,
            outbox_path=os.environ.get("URBAN_INGEST_OUTBOX_PATH")
            or ".urban-ingest/outbox.sqlite3",
        )

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

    # ============================ Auth ============================

    def _ensure_token(self) -> str:
        if not self.email or not self.password:
            raise UrbanBackendError(
                "Credenciais legadas ausentes para login JWT. "
                "Use URBAN_EVENTS_INGEST_API_KEY para /events/ingest."
            )
        if (
            self._token
            and (time.time() - self._token_acquired_at)
            < self.TOKEN_LIFETIME_SAFE_SECONDS
        ):
            return self._token
        return self._login()

    def _login(self) -> str:
        if not self.email or not self.password:
            raise UrbanBackendError(
                "Login legado indisponivel: URBAN_COLLECTOR_EMAIL e "
                "URBAN_COLLECTOR_PASSWORD nao configurados"
            )
        url = f"{self.api_base}/auth/login"
        try:
            resp = self._session.post(
                url,
                json={"email": self.email, "password": self.password},
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            raise UrbanBackendError(f"Erro de rede no login: {e}") from e

        if resp.status_code >= HTTP_BAD_REQUEST:
            raise UrbanBackendError(
                f"Login falhou (HTTP {resp.status_code}): {resp.text[:300]}"
            )

        data = resp.json()
        if not isinstance(data, dict):
            raise UrbanBackendError("Login retornou payload JSON invalido")
        token = data.get("accessToken") or data.get("access_token")
        if not isinstance(token, str) or not token:
            raise UrbanBackendError("Login sem accessToken na resposta")

        self._token = token
        self._token_acquired_at = time.time()
        logger.info("UrbanBackendClient logado como %s", self.email)
        return token

    # ========================== Buffer/flush ==========================

    def add_event(self, event: dict[str, Any]) -> None:
        """Adiciona um evento ao buffer. Auto-flush quando atinge batch_size."""
        if not event or not event.get("nome"):
            logger.debug("Ignorando evento sem o campo nome obrigatorio")
            return
        if self._outbox:
            self._outbox.enqueue(event)
        else:
            self._buffer.append(event)
        if self.buffer_size() >= self.batch_size:
            self.flush()

    def flush(self) -> dict[str, Any] | None:
        """Envia todos os eventos do buffer pro backend. Retorna response do
        backend (com agregados) ou None se buffer vazio.
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
            result = self._post_ingest(events_to_send)
        except UrbanBackendError:
            if self._outbox and owner:
                self._outbox.release(owner)
            # Keep the original buffer until a valid acknowledgment is available.
            raise
        except Exception:
            if self._outbox and owner:
                self._outbox.release(owner)
            # JSON decoding and a failed JWT refresh must not discard this batch.
            raise UrbanBackendError(
                "Ingest não confirmado; lote preservado no buffer"
            ) from None
        if self._outbox and owner:
            self._outbox.acknowledge(owner, result.get("results"))
        else:
            self._buffer = self._buffer[len(events_to_send) :]
        return result

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

        if resp.status_code == HTTP_UNAUTHORIZED and not self.ingest_api_key:
            # Token possivelmente expirou apesar do safe lifetime; força refresh
            logger.warning("/events/ingest retornou 401, refazendo login")
            self._token = None
            resp = self._session.post(
                url,
                headers=self._ingest_headers(),
                json={"events": events},
                timeout=self.timeout,
            )

        if resp.status_code >= HTTP_BAD_REQUEST:
            raise UrbanBackendError(
                f"/events/ingest falhou (HTTP {resp.status_code}): {resp.text[:300]}"
            )

        data = resp.json()
        if not isinstance(data, dict):
            raise UrbanBackendError("Ingest retornou payload JSON invalido")
        counts = [
            data.get(field) for field in ("total", "created", "updated", "skipped")
        ]
        if (
            any(type(value) is not int or value < 0 for value in counts)
            or counts[0] != len(events)
            or sum(counts[1:]) != counts[0]
        ):
            raise UrbanBackendError(
                "Ingest retornou confirmação incompatível com o lote enviado"
            )
        outcomes = data.get("results")
        if outcomes is not None or data["skipped"]:
            if not isinstance(outcomes, list) or len(outcomes) != len(events):
                raise UrbanBackendError(
                    "Ingest não detalhou o resultado de cada evento"
                )
            for status in ("created", "updated", "skipped"):
                if (
                    sum(
                        isinstance(item, dict) and item.get("status") == status
                        for item in outcomes
                    )
                    != data[status]
                ):
                    raise UrbanBackendError(
                        "Resultados individuais divergem das contagens de ingestão"
                    )
        logger.info(
            "Ingest OK: total=%s created=%s updated=%s skipped=%s",
            data.get("total"),
            data.get("created"),
            data.get("updated"),
            data.get("skipped"),
        )
        return dict(data)

    def _ingest_headers(self) -> dict[str, str]:
        if self.ingest_api_key:
            headers = {"x-urban-events-ingest-key": self.ingest_api_key}
            if self.collector_name:
                headers["x-urban-collector"] = self.collector_name
            if self.collector_version:
                headers["x-urban-collector-version"] = self.collector_version
            if self.ingest_run_id:
                headers["x-urban-ingest-run-id"] = self.ingest_run_id
            return headers

        token = self._ensure_token()
        return {"Authorization": f"Bearer {token}"}

    def buffer_size(self) -> int:
        return self._outbox.count() if self._outbox else len(self._buffer)

    def close(self) -> None:
        """Faz flush final e fecha conexão."""
        try:
            while self.buffer_size():
                if self.flush() is None:
                    raise UrbanBackendError(
                        "Eventos persistidos aguardam liberação de outro envio"
                    )
        finally:
            self._session.close()
