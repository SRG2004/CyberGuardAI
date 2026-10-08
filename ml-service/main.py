import os
import time
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import re
import cv2

app = FastAPI(title="CyberGuard ML Service", version="3.0.0")

# No root redirect needed; Gradio mounts on /

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cyber-guard-ai-seven.vercel.app",
        "https://cyberguardai-naip.onrender.com",
        "http://localhost:5000",
        "http://localhost:5173",
        "http://localhost:8001",
        "http://localhost:7860",
        # HF Spaces domains (wildcard handled by allow_origin_regex below)
    ],
    allow_origin_regex=r"https://.*\.hf\.space",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Models directory
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

# ── Global model references ───────────────────────────────────────────
url_model = None
email_model = None

# Transformer models (loaded separately)
url_transformer = None       # { 'model', 'tokenizer' } or None
email_transformer = None     # { 'model', 'tokenizer' } or None


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


# ── Deep XAI Trigger Extraction ───────────────────────────────────────
def _extract_triggers(text: str, analysis_type: str) -> List[Dict[str, str]]:
    """Extracts psychological or structural triggers for Deep XAI highlighting."""
    triggers = []
    text_lower = text.lower()
    
    if analysis_type == 'email':
        keywords = [
            "urgent", "locked", "verify", "click here", "gift card", 
            "unpaid", "free", "paypal", "password", "bank", "winner",
            "claim", "suspend", "action required"
        ]
        for kw in keywords:
            if kw in text_lower:
                triggers.append({"text": kw, "type": "Psychological Manipulation", "severity": "high", "reason": f"Urgency/financial keyword '{kw}' detected"})
    
    elif analysis_type == 'url':
        # Check for IP address
        if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', text):
            triggers.append({"text": re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', text).group(), "type": "IP Address Masking", "severity": "high", "reason": "URL uses an IP address instead of a domain name"})
        
        # Check for multiple subdomains
        parts = text.replace('https://', '').replace('http://', '').split('/')[0].split('.')
        if len(parts) > 3:
            triggers.append({"text": '.'.join(parts), "type": "Subdomain Nesting", "severity": "medium", "reason": "Excessive subdomains often used to obfuscate the true domain"})
            
        # Check for brand names in path
        brands = ['paypal', 'apple', 'google', 'amazon', 'microsoft', 'netflix', 'facebook']
        path = '/'.join(text.split('/')[3:])
        for brand in brands:
            if brand in path.lower():
                triggers.append({"text": brand, "type": "Brand Spoofing", "severity": "high", "reason": f"Brand name '{brand}' found in path instead of domain"})

        # Check for Punycode (Homograph attack)
        if 'xn--' in text_lower:
            triggers.append({"text": "xn--", "type": "Homograph Attack", "severity": "critical", "reason": "Punycode detected, which is often used to spoof characters"})
            
        # Check for Typo-squatting using Levenshtein distance
        try:
            from Levenshtein import distance as levenshtein_distance
            domain = text_lower.replace('https://', '').replace('http://', '').split('/')[0]
            domain_parts = domain.split('.')
            if len(domain_parts) >= 2:
                # E.g. www.paypa1.com -> paypa1
                main_word = domain_parts[-2]
                trusted_brands = ['paypal', 'apple', 'google', 'amazon', 'microsoft', 'netflix', 'facebook', 'chase', 'wellsfargo', 'citibank', 'instagram', 'twitter']
                for brand in trusted_brands:
                    dist = levenshtein_distance(main_word, brand)
                    if 0 < dist <= 2:
                        triggers.append({"text": main_word, "type": "Typo-squatting", "severity": "high", "reason": f"Domain '{main_word}' is suspiciously similar to trusted brand '{brand}'"})
        except ImportError:
            pass

    return triggers

# ── Transformer helper ────────────────────────────────────────────────
def _transformer_predict(model_dict, text: str, max_length: int = 128) -> float:
    """
    Run a single text through a HuggingFace Transformer or ONNX runtime
    and return the phishing probability (class 1 softmax score).
    """
    try:
        import numpy as np
        model = model_dict['model']
        tokenizer = model_dict['tokenizer']
        is_onnx = model_dict.get('is_onnx', False)

        inputs = tokenizer(
            text,
            truncation=True,
            padding="max_length" if is_onnx else False,
            max_length=max_length,
            return_tensors="np" if is_onnx else "pt"
        )

        if is_onnx:
            # ONNX Inference
            ort_inputs = {
                'input_ids': inputs['input_ids'].astype(np.int64),
                'attention_mask': inputs['attention_mask'].astype(np.int64)
            }
            logits = model.run(None, ort_inputs)[0]
            # Softmax
            exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
            probs = exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)
            return float(probs[0][1])
        else:
            # PyTorch Inference
            import torch
            with torch.no_grad():
                outputs = model(**inputs)
                probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
                return float(probs[0][1].item())
    except Exception as e:
        print(f"Transformer predict error: {e}")
        return -1.0  # sentinel: caller should ignore


def _load_transformer(model_dir: str, label: str):
    """Load a fine-tuned Transformer model + tokenizer from a directory."""
    if not os.path.exists(model_dir):
        return None
    try:
        from transformers import AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_dir)

        # Check for ONNX model first
        onnx_path = os.path.join(model_dir, "model.onnx")
        if os.path.exists(onnx_path):
            import onnxruntime as ort
            print(f"  [ONNX] {label} ONNX Engine loaded from {model_dir}")
            session = ort.InferenceSession(onnx_path)
            return {"model": session, "tokenizer": tokenizer, "is_onnx": True}

        # Fallback to PyTorch
        import torch
        from transformers import AutoModelForSequenceClassification
        model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        model.eval()
        print(f"  [PyTorch] {label} PyTorch Transformer loaded from {model_dir}")
        return {"model": model, "tokenizer": tokenizer, "is_onnx": False}
    except Exception as e:
        print(f"  [ERROR] {label} Transformer failed: {e}")
        return None


# ── Startup ───────────────────────────────────────────────────────────
def startup():
    global url_model, email_model, url_transformer, email_transformer

    url_path = os.path.join(MODELS_DIR, 'phishing_model.pkl')
    email_path = os.path.join(MODELS_DIR, 'email_model.pkl')

    # 1. Load sklearn / XGBoost models
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

    # 2. Load fine-tuned Transformer models (if available)
    print("\nLoading Transformer models...")
    url_transformer_dir = os.path.join(MODELS_DIR, 'transformer_url_phishing')
    email_transformer_dir = os.path.join(MODELS_DIR, 'finetuned_email_transformer')
    # Also check legacy single-transformer directory
    legacy_transformer_dir = os.path.join(MODELS_DIR, 'finetuned_phishing_transformer')

    url_transformer = _load_transformer(url_transformer_dir, "URL")
    email_transformer = _load_transformer(email_transformer_dir, "Email")

    # Fallback: if we have the legacy single transformer, use it for email
    if email_transformer is None:
        email_transformer = _load_transformer(legacy_transformer_dir, "Email (legacy)")

    loaded = sum(1 for t in [url_transformer, email_transformer] if t is not None)
    print(f"  Transformer models loaded: {loaded}/2")


# ── /predict/qr ───────────────────────────────────────────────────────
@app.post("/predict/qr")
async def predict_qr(file: UploadFile = File(...)):
    try:
        import cv2
        import numpy as np
        
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")
            
        detector = cv2.QRCodeDetector()
        data, bbox, _ = detector.detectAndDecode(img)
        
        if not data:
            return {"verdict": "safe", "url": "", "error": "No QR code found"}
            
        # Treat the decoded data as a URL and pass it to the URL predictor
        req = UrlRequest(url=data)
        return predict_url(req)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QR detection failed: {e}")

# ── Health Check ──────────────────────────────────────────────────────
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
        "transformers": {
            "url_transformer_loaded": url_transformer is not None,
            "email_transformer_loaded": email_transformer is not None,
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
        "transformers": {
            "url_transformer_loaded": url_transformer is not None,
            "email_transformer_loaded": email_transformer is not None,
            "base_model": "distilbert-base-uncased",
        },
    }


# ── /predict/url ──────────────────────────────────────────────────────
@app.post("/predict/url")
def predict_url(req: UrlRequest):
    global url_model, url_transformer
    import requests
    
    # ── 1. Real-Time Cross-Reference Layer (URLhaus) ──────────────
    try:
        urlhaus_resp = requests.post("https://urlhaus-api.abuse.ch/v1/url/", data={"url": req.url}, timeout=2.0)
        if urlhaus_resp.status_code == 200:
            data = urlhaus_resp.json()
            if data.get('query_status') == 'ok' and data.get('url_status') == 'online':
                return {
                    "url": req.url,
                    "verdict": "phishing",
                    "riskScore": 100.0,
                    "confidence": 100.0,
                    "xai_analysis": [{"text": "Verified by URLhaus", "type": "Threat Intel", "severity": "critical", "reason": "URL flagged by Abuse.ch"}],
                    "details": {"base_score": 1.0, "transformer_score": 1.0}
                }
    except Exception as e:
        pass # Silently fallback to ML if API fails or times out
        
    # ── 2. ML Pipeline ───────────────────────────────────────────
    try:
        from preprocess import extract_url_features

        features = extract_url_features(req.url)
        feature_order = [features.get(f, 0) for f in url_model['feature_names']]
        X = np.array([feature_order], dtype=np.float64)
        X = np.nan_to_num(X, nan=0.0, posinf=1e6, neginf=-1e6)

        if hasattr(url_model['pipeline'], 'predict_proba'):
            prob = url_model['pipeline'].predict_proba(X)[0]
            feature_prob = float(prob[1]) if len(prob) > 1 else 0.0
        else:
            prediction = url_model['pipeline'].predict(X)[0]
            feature_prob = float(prediction)

        transformer_score = -1.0
        if url_transformer is not None:
            transformer_score = _transformer_predict(url_transformer, req.url, max_length=128)

        phishing_prob = (0.4 * transformer_score + 0.6 * feature_prob) if transformer_score >= 0 else feature_prob

        is_phishing = phishing_prob > 0.5
        xai_analysis = _extract_triggers(req.url, 'url') if is_phishing else []

        return {
            "url": req.url,
            "verdict": "phishing" if is_phishing else "safe",
            "riskScore": float(phishing_prob * 100),
            "confidence": float(max(phishing_prob, 1 - phishing_prob) * 100),
            "xai_analysis": xai_analysis,
            "details": {
                "base_score": float(feature_prob),
                "transformer_score": float(transformer_score) if transformer_score >= 0 else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ── /predict/email ────────────────────────────────────────────────────
@app.post("/predict/email")
def predict_email(req: EmailRequest):
    global email_model, email_transformer
    try:
        from preprocess import clean_email_text, extract_email_features

        email_feats = extract_email_features(req.subject, req.body)
        cleaned = clean_email_text(f"{req.subject} {req.body}")
        
        text_prob = 0.0
        used_transformer = False

        if email_transformer is not None:
            # Use Transformer for text classification
            email_text = f"{req.subject} {req.body}".strip()
            t_prob = _transformer_predict(
                email_transformer,
                email_text,
                max_length=256,
            )
            if t_prob >= 0:
                text_prob = t_prob
                used_transformer = True

        # Fallback: TF-IDF / LinearSVC
        if not used_transformer:
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

        # ── Explainability (XAI) for Email ────────────────────
        explainability = []
        if text_prob > 0.6:
            explainability.append(f"+{(text_prob * 40):.1f}% risk due to NLP semantic threat match")
        if urgency > 0.5:
            explainability.append(f"+{(urgency * 35):.1f}% risk due to high urgency/pressure signals")
        if link_factor > 0.4:
            explainability.append(f"+{(link_factor * 15):.1f}% risk due to excessive or suspicious links")
        if email_feats.get('has_unsubscribe') == 0:
            explainability.append(f"+10.0% risk due to missing unsubscribe/sender info")
        
        if not explainability:
            explainability.append("- Signals indicate legitimate context")

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

        if used_transformer:
            signals.append({"type": "transformer_analysis", "text": "Deep learning text analysis applied", "severity": "info"})

        xai_analysis = _extract_triggers(req.subject + " " + req.body, 'email') if label == 'phishing' else []

        return {
            "verdict": label,
            "riskScore": float(combined * 100),
            "confidence": float(max(combined, 1 - combined) * 100),
            "xai_analysis": xai_analysis,
            "details": {
                "base_score": float(combined),
                "transformer_score": float(text_prob) if used_transformer else None,
                "urgency_score": float(urgency)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email prediction failed: {str(e)}")


# ── /predict/page ─────────────────────────────────────────────────────
@app.post("/predict/page")
def predict_page(req: PageRequest):
    """
    Aggregate page-level scoring using URL + forms + iframes + DOM anomalies + JS signals.
    This endpoint receives enriched context from the extension for more accurate verdicts.
    """
    try:
        from preprocess import extract_url_features

        # 1. URL score (Transformer-enhanced if available)
        features = extract_url_features(req.url)
        feature_order = [features.get(f, 0) for f in url_model['feature_names']]
        X = np.array([feature_order], dtype=np.float64)
        X = np.nan_to_num(X, nan=0.0, posinf=1e6, neginf=-1e6)

        if hasattr(url_model['pipeline'], 'predict_proba'):
            prob = url_model['pipeline'].predict_proba(X)[0]
            feature_url_score = float(prob[1]) if len(prob) > 1 else 0.0
        else:
            feature_url_score = float(url_model['pipeline'].predict(X)[0])

        # Ensemble with Transformer if available
        url_score = feature_url_score
        if url_transformer is not None:
            t_score = _transformer_predict(
                url_transformer['model'], url_transformer['tokenizer'], req.url, 128
            )
            if t_score >= 0:
                url_score = 0.4 * t_score + 0.6 * feature_url_score

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
            "transformer_enhanced": url_transformer is not None,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Page prediction failed: {str(e)}")


# ── /retrain ──────────────────────────────────────────────────────────
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

# Call startup to load models synchronously
startup()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8001)))
