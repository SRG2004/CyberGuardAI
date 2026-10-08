# CyberGuard AI

An enterprise-grade, AI-powered cybersecurity threat detection platform with **99.1% URL accuracy** and **99.2% email accuracy**. CyberGuard AI utilizes advanced machine learning models accelerated by Hugging Face to analyze, classify, and block malicious content in real-time.

## Architecture

| Component | Tech Stack | Environment |
|---|---|---|
| **Frontend** | React + Vite + Tailwind CSS + shadcn/ui | **Vercel** (Auto-Deploy) |
| **Backend API** | Node.js + Express + MongoDB + Puppeteer | **Render.com** (Auto-Deploy) |
| **ML Microservice** | Python + FastAPI + PyTorch + LightGBM | **Hugging Face Spaces** (GitHub Actions Sync) |
| **Extension** | Chrome MV3 Extension + Glassmorphism UI | **Browser** |

## Features

- **Advanced URL Phishing Detection** — Ensemble architecture using ONNX-optimized PyTorch Transformers and LightGBM (trained on 150K real URLs from PhishTank & URLhaus).
- **Dynamic Threat Sandboxing** — Headless Puppeteer engine embedded in the backend to safely execute and visually inspect suspicious links for invisible iframes, clickjacking overlays, and malicious JavaScript.
- **Advanced File Analysis** — Instant client-side file inspection utilizing SHA-1, SHA-256, SHA-512 cryptographic hashing and Shannon Entropy calculations to detect obfuscated malware.
- **Deep Network Traceroute** — Built-in network path inspection and redirect-chain unshortening to trace the origin of obfuscated links.
- **Enterprise Dashboard** — Threat analytics, scan history, blocklist management, and real-time model health monitoring.
- **Role-Based Access Control (RBAC)** — Strict data isolation and access segregation between users and administrators.

## Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone https://github.com/SRG2004/CyberGuardAI.git
cd CyberGuardAI
cp .env.example .env

# 2. Add your MongoDB URI to the .env file
# (e.g., MONGODB_URI=mongodb://127.0.0.1:27017/cyberguard)

# 3. Start the entire application suite instantly (Windows)
# This will automatically create Python virtual environments and launch all 3 services!
start.bat
```

*(Alternatively, you can manually run `npm run dev` in `cyberguard-ui` and `backend`, and `python -m uvicorn main:app` in `ml-service`).*

## Production Deployment Pipeline

This repository is configured with a fully automated, ultra-fast CI/CD pipeline using GitHub Actions, Vercel, and Render.

1. **Frontend (Vercel)** 
   - Vercel is connected natively to the GitHub repository. Pushing to `main` instantly builds and deploys the React frontend.
2. **Backend (Render.com)**
   - The `render.yaml` Blueprint automatically tells Render to build the Node.js API and natively configures the environment to safely run the headless Puppeteer browser within Render's memory constraints.
3. **ML Microservice (Hugging Face Spaces)**
   - A custom GitHub Action (`deploy.yml`) automatically syncs the `ml-service` directory directly to Hugging Face Spaces on every commit, skipping unnecessary Python setups to ensure lightning-fast CI deployments.

## Chrome Extension Installation

1. Go to `chrome://extensions/` in your Chrome browser.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `extension/` folder in this repository.

See [extension/README.md](extension/README.md) for deeper details on the extension architecture.

## License

MIT
