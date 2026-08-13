---
title: CyberGuard ML Service
emoji: 🛡️
colorFrom: indigo
colorTo: purple
sdk: gradio
sdk_version: 5.29.0
app_file: app.py
pinned: false
license: mit
---

# CyberGuard ML Service

AI-powered phishing and threat detection microservice using **DistilBERT Transformers** + **XGBoost** ensemble models.

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check & model status |
| `/model/info` | GET | Detailed model information |
| `/predict/url` | POST | URL phishing detection (Transformer + Feature ensemble) |
| `/predict/email` | POST | Email phishing detection (Transformer + heuristics) |
| `/predict/page` | POST | Full page context scoring |
| `/retrain` | POST | Retrain sklearn models |

## Architecture

This service runs on **Hugging Face Spaces** as a microservice, called by the Node.js backend on Render.

```
Frontend (Vercel) → Backend (Render) → ML Service (HF Spaces)
```
