
FROM prefecthq/prefect:3-python3.10

WORKDIR /app

# The installer requires curl (and certificates) to download the release archive
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates build-essential python3-dev libffi-dev

# Download the latest installer
ADD https://astral.sh/uv/install.sh /uv-installer.sh

# Run the installer then remove it
RUN sh /uv-installer.sh && rm /uv-installer.sh

# Ensure the installed binary is on the `PATH`
ENV PATH="/root/.local/bin/:$PATH"

COPY spiders_pipeline/ ./spiders_pipeline/
COPY pyproject.toml uv.lock prefect.toml prefect.yaml ./
RUN uv sync

ARG PREFECT_API_URL="https://prefect.luminalab.ai"
ENV PREFECT_API_URL="${PREFECT_API_URL}/api"

CMD ["uv", "run", "prefect", "worker", "start","--name", "urban_webscraping_worker", "--pool", "urban_webscraping_workpool", "--type", "process"]

