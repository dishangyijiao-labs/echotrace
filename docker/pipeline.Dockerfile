FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        git \
        libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY docker/pipeline.requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY config ./config

ENV PYTHONPATH=/app

CMD ["python", "-m", "src.pipeline.cli", "--help"]
