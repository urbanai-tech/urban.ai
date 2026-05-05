"""Cliente HTTP para o backend Urban AI (POST /events/ingest).

Usado pelo IngestPipeline (Scrapy) e pelos coletores de API (api-football,
Sympla API, Eventbrite, Firecrawl) pra enviar eventos ao backend de forma
unificada e dedupada.

Características:
  - Login automático com email/senha de admin "técnico"; cacheia token em
    memória até expirar (15min); refaz login antes de chamar quando expirado
  - Buffer interno de eventos: bufferiza até `batch_size` antes de enviar
    (default 100), reduz overhead HTTP
  - Retry exponencial em erro de rede / 5xx / 429
  - Fail-soft: se backend offline, escreve no log + segura buffer pra
    próximo flush (não perde eventos do dia)

Variáveis de ambiente esperadas:
  URBAN_API_BASE       — ex: https://api.myurbanai.com (default localhost:10000)
  URBAN_COLLECTOR_EMAIL — login do user admin técnico
  URBAN_COLLECTOR_PASSWORD — senha
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


logger = logging.getLogger(__name__)


class UrbanBackendError(Exception):
    """Erro genérico ao falar com o backend."""


class UrbanBackendClient:
    """Cliente leve para POST /events/ingest com login JWT.

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

    def __init__(
        self,
        api_base: str,
        email: str,
        password: str,
        batch_size: int = DEFAULT_BATCH_SIZE,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        self.api_base = api_base.rstrip("/")
        self.email = email
        self.password = password
        self.batch_size = batch_size
        self.timeout = timeout

        self._token: str | None = None
        self._token_acquired_at: float = 0.0

        self._buffer: list[dict[str, Any]] = []

        self._session = self._build_session()

    @classmethod
    def from_env(cls, batch_size: int = DEFAULT_BATCH_SIZE) -> "UrbanBackendClient":
        """Constrói via env vars. Lança ValueError se faltar configuração."""
        api_base = os.environ.get("URBAN_API_BASE", "http://localhost:10000")
        email = os.environ.get("URBAN_COLLECTOR_EMAIL")
        password = os.environ.get("URBAN_COLLECTOR_PASSWORD")
        if not email or not password:
            raise ValueError(
                "URBAN_COLLECTOR_EMAIL e URBAN_COLLECTOR_PASSWORD obrigatórios "
                "para o IngestPipeline (criar usuário admin no backend e setar "
                "as envs). Sem isso o pipeline desabilita o ingest."
            )
        return cls(api_base=api_base, email=email, password=password, batch_size=batch_size)

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

    # ============================ Auth ============================

    def _ensure_token(self) -> str:
        if self._token and (time.time() - self._token_acquired_at) < self.TOKEN_LIFETIME_SAFE_SECONDS:
            return self._token
        return self._login()

    def _login(self) -> str:
        url = f"{self.api_base}/auth/login"
        try:
            resp = self._session.post(
                url,
                json={"email": self.email, "password": self.password},
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            raise UrbanBackendError(f"Erro de rede no login: {e}") from e

        if resp.status_code >= 400:
            raise UrbanBackendError(
                f"Login falhou (HTTP {resp.status_code}): {resp.text[:300]}"
            )

        data = resp.json()
        token = data.get("accessToken") or data.get("access_token")
        if not token:
            raise UrbanBackendError(f"Login sem accessToken na resposta: {data}")

        self._token = token
        self._token_acquired_at = time.time()
        logger.info("UrbanBackendClient logado como %s", self.email)
        return token

    # ========================== Buffer/flush ==========================

    def add_event(self, event: dict[str, Any]) -> None:
        """Adiciona um evento ao buffer. Auto-flush quando atinge batch_size."""
        if not event or not event.get("nome"):
            logger.debug("Ignorando evento sem nome: %s", event)
            return
        self._buffer.append(event)
        if len(self._buffer) >= self.batch_size:
            self.flush()

    def flush(self) -> dict[str, Any] | None:
        """Envia todos os eventos do buffer pro backend. Retorna response do
        backend (com agregados) ou None se buffer vazio.
        """
        if not self._buffer:
            return None

        events_to_send = self._buffer[: self.batch_size]
        self._buffer = self._buffer[self.batch_size :]

        try:
            return self._post_ingest(events_to_send)
        except UrbanBackendError:
            # Re-coloca no buffer pra retry no próximo flush
            self._buffer = events_to_send + self._buffer
            raise

    def _post_ingest(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        token = self._ensure_token()
        url = f"{self.api_base}/events/ingest"
        try:
            resp = self._session.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json={"events": events},
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            raise UrbanBackendError(f"Erro de rede em /events/ingest: {e}") from e

        if resp.status_code == 401:
            # Token possivelmente expirou apesar do safe lifetime; força refresh
            logger.warning("/events/ingest retornou 401, refazendo login")
            self._token = None
            token = self._ensure_token()
            resp = self._session.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json={"events": events},
                timeout=self.timeout,
            )

        if resp.status_code >= 400:
            raise UrbanBackendError(
                f"/events/ingest falhou (HTTP {resp.status_code}): {resp.text[:300]}"
            )

        data = resp.json()
        logger.info(
            "Ingest OK: total=%s created=%s updated=%s skipped=%s",
            data.get("total"),
            data.get("created"),
            data.get("updated"),
            data.get("skipped"),
        )
        return data

    def buffer_size(self) -> int:
        return len(self._buffer)

    def close(self) -> None:
        """Faz flush final e fecha conexão."""
        try:
            while self._buffer:
                self.flush()
        finally:
            self._session.close()
