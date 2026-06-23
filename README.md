# CyberGuard AI

AI-powered phishing and cybersecurity threat detection platform with **99.1% URL accuracy** and **99.2% email accuracy**.

## Architecture

| Component | Tech | Port |
|---|---|---|
| **Frontend** | React + Vite + Tailwind + shadcn/ui | 5173 |
| **Backend API** | Node.js + Express + MongoDB | 5000 |
| **ML Service** | Python + FastAPI + XGBoost | 8001 |
| **Extension** | Chrome MV3 Extension | — |

## Features

- **URL Phishing Detection** — 39 features, trained on 150K real URLs from PhishTank, OpenPhish, URLhaus
- **Email Phishing Detection** — TF-IDF + urgency analysis + link detection
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

### Option 1: Render.com + Vercel (Free)

1. **MongoDB Atlas** — Create free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **Push to GitHub** — `git push origin main`
3. **Render.com** — Connect repo → auto-detects `render.yaml` → deploys backend + ML service
4. **Vercel** — Import `cyberguard-ui` folder → auto-deploys frontend
5. **Set env vars** — Update `MONGODB_URI`, `FRONTEND_URL`, `ML_SERVICE_URL` in Render dashboard

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
