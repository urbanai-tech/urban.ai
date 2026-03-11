# Dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app
ADD . /app

# 1) Sync project deps (without installing the project)
RUN uv sync --frozen --no-install-project --no-dev --no-cache --compile-bytecode

# 2) Install Playwright browsers (you already do this)
ENV PLAYWRIGHT_BROWSERS_PATH=/browsers
RUN uv run playwright install --with-deps firefox \
 && uv run playwright install --with-deps chromium \
 && chmod -Rf 777 $PLAYWRIGHT_BROWSERS_PATH

# 3) Install project (and your runtime deps)
RUN uv sync --frozen --no-dev --no-cache --compile-bytecode

# 4) Install Scrapyd + client (add these also to your pyproject for long-term)
RUN uv run pip install --no-cache-dir scrapyd scrapyd-client

# (optional) directories for scrapyd state
RUN mkdir -p /app/eggs /app/logs /app/dbs

# 5) Scrapyd config (optional but recommended)
COPY scrapyd.conf /etc/scrapyd/scrapyd.conf

EXPOSE 6800
# Run scrapyd in foreground, binding publicly
ENTRYPOINT ["uv"]
CMD ["run", "scrapyd", "-n", "-a", "0.0.0.0", "-p", "6800"]
