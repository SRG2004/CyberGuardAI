# CyberGuard AI

AI-powered phishing and cybersecurity threat detection platform with **99.1% URL accuracy** and **99.2% email accuracy**.

## Architecture

| Component | Tech | Environment |
|---|---|---|
| **Frontend** | React + Vite + Tailwind + shadcn/ui | Vercel |
| **Backend API** | Node.js + Express + MongoDB | Render.com |
| **ML Microservice** | Python + FastAPI + DistilBERT + XGBoost | Hugging Face Spaces (16GB RAM) |
| **Extension** | Chrome MV3 Extension | Browser |

## Features

- **URL Phishing Detection** — DistilBERT Transformer + XGBoost ensemble (39 features), trained on PhishTank, OpenPhish, URLhaus
- **Email Phishing Detection** — Fine-tuned DistilBERT Transformer + urgency analysis + link detection
- **Chrome Extension** — Real-time page scanning with form, iframe, DOM anomaly, and JS obfuscation detection
- **Dashboard** — Threat analytics, scan history, blocklist management

## Quick Start (Local)

```bash
# 1. Clone & setup
git clone https://github.com/YOUR_USERNAME/CyberGuardAI.git
cd CyberGuardAI
cp .env.example .env
# Edit .env with your MongoDB URI

# 2. Start all services (Windows)
start.bat

# 3. Or start individually:
# Backend
cd backend && npm install && npm run dev

# ML Service
cd ml-service && pip install -r requirements.txt && python -m uvicorn main:app --port 8001 --reload

# Frontend
cd cyberguard-ui && npm install && npm run dev
```

## Deploy to Production

### Option 1: Render.com + Hugging Face Spaces + Vercel (Recommended Free Stack)

1. **MongoDB Atlas** — Create free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **ML Microservice (Hugging Face Spaces)** — Create a **Gradio** Space at [huggingface.co/spaces](https://huggingface.co/spaces) (free tier with 16GB RAM), upload `ml-service/` folder.
3. **Backend (Render.com)** — Connect repo → auto-detects `render.yaml` → deploys Node.js backend. Set `ML_SERVICE_URL` to your HF Space URL.
4. **Frontend (Vercel)** — Import `cyberguard-ui` folder → auto-deploys frontend.

### Option 2: Docker Compose

```bash
docker compose up -d
```

## ML Model Performance

| Model | Accuracy | F1 | Training Data |
|---|---|---|---|
| **URL (XGBoost)** | 99.1% | 99.1% | 150K real URLs |
| **Email (LinearSVC)** | 99.2% | 99.2% | 3,759 emails |

## Chrome Extension

1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" → select `extension/` folder

See [extension/README.md](extension/README.md) for details.

## License

MIT
