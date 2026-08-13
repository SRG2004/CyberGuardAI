FROM python:3.11-slim

# HF Spaces requires this label
LABEL maintainer="CyberGuard AI"

RUN groupadd -r cyberguard && useradd -r -g cyberguard -m appuser

WORKDIR /app

# Install system deps for scikit-learn / xgboost / lightgbm / torch
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p models data && chown -R appuser:cyberguard models data

USER appuser

# HF Spaces uses port 7860 by default
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/health')"

# Use PORT env var (HF Spaces sets PORT=7860)
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
