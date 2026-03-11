# Build an egg of your project.

FROM python:3.12-slim AS build-stage

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /workdir

COPY uv.lock /workdir/uv.lock
COPY pyproject.toml /workdir/pyproject.toml

RUN uv venv \
  && uv pip install scrapyd-client

COPY . .

RUN uv run scrapyd-deploy --build-egg=urban_webscrapping.egg

RUN ls -lR

# Build the image.
FROM mcr.microsoft.com/playwright:v1.55.0-noble-amd64

# Copy UV
COPY --from=build-stage /bin/uv /bin/uv

# Install Scrapy dependencies - and any others for your project.
COPY --from=build-stage /workdir/pyproject.toml .
COPY --from=build-stage /workdir/uv.lock .

USER root
RUN uv sync --active --frozen --no-install-project --no-dev --no-cache --compile-bytecode

RUN uv run playwright install --with-deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt-dev \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Volumes are managed by the deployment platform (e.g., Railway).
COPY ./scrapyd.conf /etc/scrapyd/

RUN mkdir -p /src/eggs/urban_webscrapping
COPY --from=build-stage /workdir/urban_webscrapping.egg /src/eggs/urban_webscrapping/1.egg

EXPOSE 6800

ENTRYPOINT ["uv", "run", "scrapyd", "--pidfile="]