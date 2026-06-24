import os
import time
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import re

app = FastAPI(title="CyberGuard ML Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cyber-guard-ai-seven.vercel.app",
        "https://cyberguardai-naip.onrender.com",
        "http://localhost:5000",
        "http://localhost:5173",
        "http://localhost:8001",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Models directory
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

url_model = None
email_model = None

class UrlRequest(BaseModel):
    url: str

class EmailRequest(BaseModel):
    subject: str = ""
    body: str = ""

class PageRequest(BaseModel):
    """Full page context from extension for aggregate scoring."""
    url: str
    links: List[str] = []
    forms: List[dict] = []
    iframes: List[dict] = []
    dom_anomalies: List[dict] = []
    js_signals: List[dict] = []
    redirect_chain: List[str] = []

@app.on_event("startup")
def startup():
    global url_model, email_model
    url_path = os.path.join(MODELS_DIR, 'phishing_model.pkl')
    email_path = os.path.join(MODELS_DIR, 'email_model.pkl')

    if not os.path.exists(url_path) or not os.path.exists(email_path):
        print("Models not found, training...")
        from train import train_url_model, train_email_model
        url_model = train_url_model()
        email_model = train_email_model()
    else:
        url_model = joblib.load(url_path)
        email_model = joblib.load(email_path)
        print(f"Models loaded successfully")
        print(f"  URL model: {url_model.get('model_type', 'unknown')} "
              f"(accuracy={url_model.get('accuracy', 0)}, features={url_model.get('n_features', 0)})")
        print(f"  Email model: {email_model.get('model_type', 'unknown')} "
              f"(accuracy={email_model.get('accuracy', 0)})")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "model_loaded": url_model is not None and email_model is not None,
        "url_model": {
            "accuracy": url_model.get('accuracy', 0) if url_model else 0,
            "f1_score": url_model.get('f1_score', 0) if url_model else 0,
            "model_type": url_model.get('model_type', 'none') if url_model else 'none',
            "n_features": url_model.get('n_features', 0) if url_model else 0,
        },
        "email_model": {
            "accuracy": email_model.get('accuracy', 0) if email_model else 0,
            "model_type": email_model.get('model_type', 'none') if email_model else 'none',
        },
    }

@app.get("/model/info")
def model_info():
    """Return detailed model information."""
    return {
        "url_model": {
            "accuracy": url_model.get('accuracy', 0) if url_model else 0,
            "f1_score": url_model.get('f1_score', 0) if url_model else 0,
            "cv_accuracy_mean": url_model.get('cv_accuracy_mean', 0) if url_model else 0,
            "cv_accuracy_std": url_model.get('cv_accuracy_std', 0) if url_model else 0,
            "model_type": url_model.get('model_type', 'none') if url_model else 'none',
            "n_features": url_model.get('n_features', 0) if url_model else 0,
            "training_dataset_size": url_model.get('training_dataset_size', 0) if url_model else 0,
            "training_samples": url_model.get('training_samples', 0) if url_model else 0,
            "training_time_seconds": url_model.get('training_time_seconds', 0) if url_model else 0,
            "trained_at": url_model.get('trained_at', 'unknown') if url_model else 'unknown',
            "data_sources": url_model.get('data_sources', 'unknown') if url_model else 'unknown',
            "all_results": url_model.get('all_results', {}) if url_model else {},
            "feature_names": url_model.get('feature_names', []) if url_model else [],
        },
        "email_model": {
            "accuracy": email_model.get('accuracy', 0) if email_model else 0,
            "f1_score": email_model.get('f1_score', 0) if email_model else 0,
            "model_type": email_model.get('model_type', 'none') if email_model else 'none',
            "training_dataset_size": email_model.get('training_dataset_size', 0) if email_model else 0,
            "trained_at": email_model.get('trained_at', 'unknown') if email_model else 'unknown',
            "all_results": email_model.get('all_results', {}) if email_model else {},
        },
    }

@app.post("/predict/url")
def predict_url(req: UrlRequest):
    try:
        from preprocess import extract_url_features

        features = extract_url_features(req.url)
        feature_order = [features.get(f, 0) for f in url_model['feature_names']]
        X = np.array([feature_order], dtype=np.float64)
        X = np.nan_to_num(X, nan=0.0, posinf=1e6, neginf=-1e6)

        # Get probability
        if hasattr(url_model['pipeline'], 'predict_proba'):
            prob = url_model['pipeline'].predict_proba(X)[0]
            phishing_prob = float(prob[1]) if len(prob) > 1 else 0.0
        else:
            prediction = url_model['pipeline'].predict(X)[0]
            phishing_prob = float(prediction)

        # Determine features that contributed
        active_features = []
        if features.get('has_at', 0) == 1:
            active_features.append('at_symbol_in_url')
        if features.get('has_ip_address', 0) == 1:
            active_features.append('ip_address_in_url')
        if features.get('phishing_keywords', 0) > 0:
            active_features.append(f'{features["phishing_keywords"]}_phishing_keywords')
        if features.get('domain_entropy', 0) > 3.5:
            active_features.append('high_domain_entropy')
        if features.get('subdomain_count', 0) > 2:
            active_features.append('excessive_subdomains')
        if features.get('url_length', 0) > 75:
            active_features.append('long_url')
        if features.get('shortener', 0) == 1:
            active_features.append('url_shortener')
        if features.get('has_punycode', 0) == 1:
            active_features.append('punycode_idn_attack')
        if features.get('brand_in_subdomain', 0) == 1:
            active_features.append('brand_impersonation')
        if features.get('brand_similarity', 1.0) < 0.3:
            active_features.append('typosquatting_detected')
        if features.get('tld_risk_score', 0) > 0.7:
            active_features.append('high_risk_tld')
        if features.get('suspicious_tld_combo', 0) == 1:
            active_features.append('suspicious_tld_keyword_combo')
        if features.get('has_hex_chars', 0) > 3:
            active_features.append('url_obfuscation')
        if features.get('path_has_suspicious_ext', 0) == 1:
            active_features.append('suspicious_file_extension')
        if features.get('port_present', 0) == 1:
            active_features.append('non_standard_port')

        label = 'phishing' if phishing_prob > 0.5 else 'legitimate'

        return {
            "score": round(phishing_prob, 4),
            "label": label,
            "features": active_features if active_features else ['baseline_features'],
            "confidence": round(max(phishing_prob, 1 - phishing_prob), 4),
            "model_type": url_model.get('model_type', 'unknown'),
            "model_accuracy": url_model.get('accuracy', 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/predict/email")
def predict_email(req: EmailRequest):
    try:
        from preprocess import clean_email_text, extract_email_features

        email_feats = extract_email_features(req.subject, req.body)

        # TF-IDF prediction
        cleaned = clean_email_text(f"{req.subject} {req.body}")
        text_prob = 0.0

        if email_model and 'pipeline' in email_model:
            if hasattr(email_model['pipeline'], 'predict_proba'):
                probs = email_model['pipeline'].predict_proba([cleaned])
                text_prob = float(probs[0][1]) if len(probs[0]) > 1 else 0.0
            else:
                # LinearSVC doesn't have predict_proba — use decision_function
                decision = email_model['pipeline'].decision_function([cleaned])
                # Convert to probability-like score using sigmoid
                text_prob = 1.0 / (1.0 + np.exp(-float(decision[0])))

        # Combined score
        urgency = email_feats['urgency_score']
        link_factor = min(email_feats['link_ratio'] / 3.0, 1.0)
        combined = 0.4 * text_prob + 0.35 * urgency + 0.15 * link_factor + 0.1 * (1 - email_feats['has_unsubscribe'])
        combined = min(max(combined, 0), 1)

        label = 'phishing' if combined > 0.5 else 'legitimate'

        # Extract highlights
        signals = []
        highlights = []

        # Find urgency phrases in text
        urgency_phrases_list = ['immediate action', 'act now', 'verify your account', 'suspended',
                               'unusual activity', 'confirm your identity', 'urgent', 'action required',
                               'security alert', 'final notice', 'password reset', 'account locked']
        text_lower = (req.subject + " " + req.body).lower()

        for phrase in urgency_phrases_list:
            idx = text_lower.find(phrase)
            if idx >= 0:
                end = idx + len(phrase)
                signals.append({"type": "urgency", "text": phrase, "severity": "high"})
                highlights.append({"start": idx, "end": end, "reason": "urgency_phrase", "color": "red"})

        # Suspicious links
        links = re.findall(r'https?://[^\s<>]+', req.body)
        for link in links[:5]:
            signals.append({"type": "suspicious_link", "url": link, "severity": "medium"})

        # Sender domain check
        email_pattern = re.findall(r'[\w\.-]+@[\w\.-]+', req.body)
        if email_pattern:
            signals.append({"type": "sender_domain", "text": email_pattern[0], "severity": "low"})

        return {
            "score": round(float(combined), 4),
            "label": label,
            "signals": signals,
            "highlights": highlights,
            "urgency_score": round(urgency, 4),
            "text_probability": round(text_prob, 4),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email prediction failed: {str(e)}")


@app.post("/predict/page")
def predict_page(req: PageRequest):
    """
    Aggregate page-level scoring using URL + forms + iframes + DOM anomalies + JS signals.
    This endpoint receives enriched context from the extension for more accurate verdicts.
    """
    try:
        from preprocess import extract_url_features

        # 1. URL score
        features = extract_url_features(req.url)
        feature_order = [features.get(f, 0) for f in url_model['feature_names']]
        X = np.array([feature_order], dtype=np.float64)
        X = np.nan_to_num(X, nan=0.0, posinf=1e6, neginf=-1e6)

        if hasattr(url_model['pipeline'], 'predict_proba'):
            prob = url_model['pipeline'].predict_proba(X)[0]
            url_score = float(prob[1]) if len(prob) > 1 else 0.0
        else:
            url_score = float(url_model['pipeline'].predict(X)[0])

        # 2. Form risk signals
        form_score = 0.0
        form_signals = []
        for form in req.forms:
            action = form.get('action', '')
            fields = form.get('fields', [])
            method = form.get('method', 'get').lower()

            has_password = any('password' in f.get('type', '').lower() or 'password' in f.get('name', '').lower() for f in fields)
            has_credential = any(kw in (f.get('name', '') + f.get('type', '')).lower()
                                for f in fields for kw in ['email', 'user', 'login', 'ssn', 'card', 'cvv', 'pin'])

            if has_password or has_credential:
                # Check if form posts to a different domain
                try:
                    from urllib.parse import urlparse
                    page_domain = urlparse(req.url).hostname
                    action_domain = urlparse(action).hostname if action else page_domain
                    cross_origin = action_domain and page_domain and action_domain != page_domain
                except Exception:
                    cross_origin = False

                if cross_origin:
                    form_score = max(form_score, 0.9)
                    form_signals.append({"type": "cross_origin_credential_form", "severity": "critical", "action": action})
                elif has_password:
                    form_score = max(form_score, 0.5)
                    form_signals.append({"type": "password_form_detected", "severity": "medium"})

        # 3. iframe risk
        iframe_score = 0.0
        iframe_signals = []
        for iframe in req.iframes:
            src = iframe.get('src', '')
            is_hidden = iframe.get('hidden', False)
            if src and is_hidden:
                iframe_score = max(iframe_score, 0.7)
                iframe_signals.append({"type": "hidden_iframe", "severity": "high", "src": src})
            elif src:
                try:
                    from urllib.parse import urlparse
                    page_domain = urlparse(req.url).hostname
                    iframe_domain = urlparse(src).hostname
                    if iframe_domain and page_domain and iframe_domain != page_domain:
                        iframe_score = max(iframe_score, 0.3)
                        iframe_signals.append({"type": "cross_origin_iframe", "severity": "medium", "src": src})
                except Exception:
                    pass

        # 4. DOM anomaly scoring
        dom_score = 0.0
        dom_signals = []
        for anomaly in req.dom_anomalies:
            atype = anomaly.get('type', '')
            if atype == 'transparent_overlay':
                dom_score = max(dom_score, 0.8)
                dom_signals.append({"type": "transparent_overlay", "severity": "high"})
            elif atype == 'hidden_input':
                dom_score = max(dom_score, 0.3)
                dom_signals.append({"type": "hidden_input", "severity": "low"})
            elif atype == 'clipboard_hijack':
                dom_score = max(dom_score, 0.6)
                dom_signals.append({"type": "clipboard_hijack", "severity": "high"})

        # 5. JS obfuscation signals
        js_score = 0.0
        js_signals_out = []
        for sig in req.js_signals:
            stype = sig.get('type', '')
            if stype in ('eval_usage', 'document_write'):
                js_score = max(js_score, 0.4)
                js_signals_out.append({"type": stype, "severity": "medium"})
            elif stype == 'obfuscated_code':
                js_score = max(js_score, 0.6)
                js_signals_out.append({"type": stype, "severity": "high"})

        # 6. Redirect chain risk
        redirect_score = 0.0
        if len(req.redirect_chain) > 3:
            redirect_score = min(len(req.redirect_chain) * 0.15, 0.8)

        # Aggregate score (weighted combination)
        aggregate = (
            0.40 * url_score +
            0.25 * form_score +
            0.10 * iframe_score +
            0.10 * dom_score +
            0.08 * js_score +
            0.07 * redirect_score
        )
        aggregate = min(max(aggregate, 0), 1)

        label = 'malicious' if aggregate > 0.6 else ('suspicious' if aggregate > 0.3 else 'safe')

        return {
            "score": round(aggregate, 4),
            "label": label,
            "breakdown": {
                "url_score": round(url_score, 4),
                "form_score": round(form_score, 4),
                "iframe_score": round(iframe_score, 4),
                "dom_score": round(dom_score, 4),
                "js_score": round(js_score, 4),
                "redirect_score": round(redirect_score, 4),
            },
            "signals": form_signals + iframe_signals + dom_signals + js_signals_out,
            "redirect_chain_length": len(req.redirect_chain),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Page prediction failed: {str(e)}")


@app.post("/retrain")
def retrain_endpoint():
    try:
        from train import train_url_model, train_email_model

        url_result = train_url_model()
        email_result = train_email_model()

        global url_model, email_model
        url_model = joblib.load(os.path.join(MODELS_DIR, 'phishing_model.pkl'))
        email_model = joblib.load(os.path.join(MODELS_DIR, 'email_model.pkl'))

        return {
            "success": True,
            "url_model": {
                "accuracy": url_result['accuracy'],
                "f1_score": url_result['f1_score'],
                "model_type": url_result['model_type'],
                "training_samples": url_result['training_samples'],
                "data_sources": url_result.get('data_sources', 'unknown'),
            },
            "email_model": {
                "accuracy": email_result['accuracy'],
                "f1_score": email_result['f1_score'],
                "model_type": email_result['model_type'],
                "training_samples": email_result['training_samples'],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retraining failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
