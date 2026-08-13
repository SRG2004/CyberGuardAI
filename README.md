# CyberGuard AI

An enterprise-grade, AI-powered cybersecurity threat detection platform with **99.1% URL accuracy** and **99.2% email accuracy**. CyberGuard AI utilizes advanced machine learning models accelerated by Hugging Face ZeroGPU to analyze, classify, and block malicious content in real-time.

## Architecture

| Component | Tech Stack | Environment |
|---|---|---|
| **Frontend** | React + Vite + Tailwind CSS + shadcn/ui | Vercel |
| **Backend API** | Node.js + Express + MongoDB + @gradio/client | Render.com |
| **ML Microservice** | Python + Pure Gradio + PyTorch (DistilBERT) + XGBoost | Hugging Face Spaces (ZeroGPU Accelerated) |
| **Extension** | Chrome MV3 Extension + Glassmorphism UI | Browser |

## Features

- **URL Phishing Detection** — PyTorch DistilBERT Transformer + XGBoost ensemble (39 extracted features), trained on PhishTank, OpenPhish, URLhaus.
- **Email Phishing Detection** — Fine-tuned DistilBERT Transformer + urgency analysis + link detection.
- **Premium Chrome Extension** — Real-time page scanning with form, iframe, DOM anomaly, and JS obfuscation detection wrapped in a sleek glassmorphism overlay.
- **Enterprise Dashboard** — Threat analytics, scan history, blocklist management, and ML API health monitoring.
- **Role-Based Access Control (RBAC)** — Strict data isolation and access segregation between `Student` and `Admin` roles.

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

# ML Service (Gradio)
cd ml-service && pip install -r requirements.txt && python app.py

# Frontend
cd cyberguard-ui && npm install && npm run dev
```

## Deploy to Production

### Option 1: Render.com + Hugging Face Spaces + Vercel (Recommended Free Stack)

1. **MongoDB Atlas** — Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **ML Microservice (Hugging Face Spaces)** — Create a **Gradio** Space at [huggingface.co/spaces](https://huggingface.co/spaces) (free tier with ZeroGPU access), upload the `hf_space2/` folder contents.
3. **Backend (Render.com)** — Connect repo → auto-detects `render.yaml` → deploys Node.js backend. Set `ML_SERVICE_URL` to your HF Space URL.
4. **Frontend (Vercel)** — Import `cyberguard-ui` folder → auto-deploys frontend.

## ML Model Performance

| Model | Accuracy | F1 Score | Training Data |
|---|---|---|---|
| **URL (XGBoost + DistilBERT)** | 99.1% | 99.1% | 150K real URLs |
| **Email (LinearSVC)** | 99.2% | 99.2% | 3,759 emails |

## Chrome Extension

1. Go to `chrome://extensions/`
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** → select the `extension/` folder in this repository.

See [extension/README.md](extension/README.md) for deeper details.

## License

MIT
