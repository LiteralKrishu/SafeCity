FROM python:3.11-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    TF_USE_LEGACY_KERAS=1 \
    TFHUB_CACHE_DIR=/models

WORKDIR /app

RUN groupadd --system safecity \
    && useradd --system --gid safecity --home-dir /app safecity \
    && mkdir -p /data /models \
    && chown -R safecity:safecity /app /data /models

COPY --chown=safecity:safecity pyproject.toml ./
COPY --chown=safecity:safecity app ./app
RUN pip install .

USER safecity

FROM base AS test

USER root
RUN pip install ".[dev]"
USER safecity

CMD ["pytest", "-q"]

FROM base AS runtime

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
