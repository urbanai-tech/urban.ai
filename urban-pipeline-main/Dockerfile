FROM python:3.12-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates build-essential python3-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar uv
ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin/:$PATH"

# Copiar dependências primeiro (cache)
COPY pyproject.toml uv.lock prefect.toml prefect.yaml ./
COPY spiders_pipeline/ ./spiders_pipeline/
COPY raw_data_pipeline/ ./raw_data_pipeline/
RUN uv sync --no-dev

# Prefect config via env
ENV PREFECT_API_URL=""

CMD ["uv", "run", "prefect", "worker", "start", "--name", "urban_webscraping_worker", "--pool", "urban_webscraping_workpool", "--type", "process"]
