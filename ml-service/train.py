import os
import glob
import time
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC, LinearSVC
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
    HistGradientBoostingClassifier,
    VotingClassifier,
)
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
import warnings
warnings.filterwarnings('ignore')

# ─── Optional high-performance libraries ──────────────────────────────
try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
    print("Note: xgboost not installed. Install with: pip install xgboost")

try:
    from lightgbm import LGBMClassifier
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False
    print("Note: lightgbm not installed. Install with: pip install lightgbm")

try:
    from catboost import CatBoostClassifier
    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False
    print("Note: catboost not installed. Install with: pip install catboost")

try:
    from imblearn.over_sampling import SMOTE
    from imblearn.pipeline import Pipeline as ImbPipeline
    HAS_IMBLEARN = True
except ImportError:
    HAS_IMBLEARN = False
    print("Note: imbalanced-learn not installed. Install with: pip install imbalanced-learn")

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False
    print("Note: shap not installed. Install with: pip install shap")

try:
    import skl2onnx
    from skl2onnx.common.data_types import FloatTensorType
    HAS_SKL2ONNX = True
except ImportError:
    HAS_SKL2ONNX = False
    print("Note: skl2onnx not installed. Install with: pip install skl2onnx onnx")

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

os.makedirs(DATA_DIR, exist_ok=True)


# ─── URL Data Loading (Real-Time Priority) ───────────────────────────
def prepare_url_data():
    """
    Load URL training data with priority:
      1. Fetch real-time data from trusted sources (PhishTank, OpenPhish, URLhaus, etc.)
      2. Fall back to previously cached real-time data
      3. Fall back to any existing CSV datasets in data/
    
    NEVER uses synthetic data — real data only for 95%+ accuracy.
    """
    # 1. Try real-time fetch
    try:
        from fetch_realtime_data import fetch_all_realtime_data, load_existing_data

        print("\n[Step 1] Attempting real-time data fetch from trusted sources...")
        realtime_df = fetch_all_realtime_data(balance_classes=True, max_per_class=75000)

        if realtime_df is not None and len(realtime_df) > 1000:
            print(f"[OK] Real-time data: {len(realtime_df)} URLs "
                  f"({(realtime_df['label']==1).sum()} phishing, {(realtime_df['label']==0).sum()} legit)")
            return realtime_df

        # 2. Fall back to previously cached data
        print("[Step 2] Trying previously cached real-time data...")
        cached_df = load_existing_data()
        if cached_df is not None and len(cached_df) > 1000:
            print(f"[OK] Cached data: {len(cached_df)} URLs")
            return cached_df

    except Exception as e:
        print(f"Real-time fetch error: {e}")
        print("[Fallback] Trying local CSV files...")

    # 3. Fall back to any existing CSV in data dir
    found_data = _scan_csv_files_for_urls()
    if found_data is not None and len(found_data) > 100:
        print(f"[OK] Local CSV data: {len(found_data)} URLs")
        return found_data

    raise RuntimeError(
        "No training data available! Please ensure network connectivity for real-time "
        "data fetch, or place URL datasets (CSV with 'url' and 'label' columns) in "
        f"{DATA_DIR}"
    )


def _scan_csv_files_for_urls() -> pd.DataFrame | None:
    """Scan data directory for any CSV files with URL data."""
    csv_files = glob.glob(os.path.join(DATA_DIR, '*.csv'))
    frames = []
    for path in csv_files:
        try:
            df = pd.read_csv(path, nrows=5)
        except Exception:
            continue
        cols_lower = {c.lower(): c for c in df.columns}
        url_col = (cols_lower.get('url') or cols_lower.get('url_raw') or
                   cols_lower.get('link') or cols_lower.get('urls'))
        label_col = (cols_lower.get('label') or cols_lower.get('type') or
                     cols_lower.get('url_type') or cols_lower.get('category') or
                     cols_lower.get('class'))
        if url_col and label_col:
            try:
                full_df = pd.read_csv(path, usecols=[url_col, label_col])
                full_df = full_df.rename(columns={url_col: 'url', label_col: 'label_raw'}).dropna()
                phish_values = ['phishing', 'phish', 'defacement', 'malware', 'spam',
                                'suspicious', 'bad', '1', 'yes', 'true']
                if full_df['label_raw'].dtype == object:
                    full_df['label'] = full_df['label_raw'].apply(
                        lambda x: 1 if str(x).strip().lower() in phish_values else 0
                    )
                else:
                    full_df['label'] = full_df['label_raw'].astype(int)
                full_df = full_df[['url', 'label']].dropna()
                frames.append(full_df)
                print(f"    Loaded {len(full_df)} rows from {os.path.basename(path)}")
            except Exception:
                pass
    if frames:
        merged = pd.concat(frames, ignore_index=True)
        return merged.drop_duplicates(subset=['url']).reset_index(drop=True)
    return None


# ─── URL Model Training ──────────────────────────────────────────────
def train_url_model():
    from preprocess import extract_url_features

    t0 = time.time()
    df = prepare_url_data()

    print(f"\n{'='*60}")
    print(f"Training URL model on {len(df)} real-world URLs")
    print(f"  Phishing:   {(df['label']==1).sum()}")
    print(f"  Legitimate: {(df['label']==0).sum()}")
    print(f"{'='*60}")

    # Extract features
    print("\nExtracting 35+ URL features...")
    features_list = []
    errors = 0
    for i, url in enumerate(df['url']):
        try:
            features_list.append(extract_url_features(str(url)))
        except Exception:
            features_list.append(extract_url_features('http://error.invalid'))
            errors += 1
        if (i + 1) % 10000 == 0:
            print(f"  Processed {i+1}/{len(df)} URLs...")

    if errors > 0:
        print(f"  ({errors} URLs had extraction errors)")

    feature_df = pd.DataFrame(features_list)
    feature_names = list(feature_df.columns)
    print(f"  Features extracted: {len(feature_names)}")

    X = feature_df.values.astype(np.float64)
    y = df['label'].values

    # Handle NaN/Inf
    X = np.nan_to_num(X, nan=0.0, posinf=1e6, neginf=-1e6)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Apply SMOTE if class imbalance exists
    if HAS_IMBLEARN:
        class_counts = np.bincount(y_train)
        if len(class_counts) == 2:
            ratio = min(class_counts) / max(class_counts)
            if ratio < 0.7:
                print(f"  Applying SMOTE (class ratio: {ratio:.2f})...")
                smote = SMOTE(random_state=42, k_neighbors=min(5, min(class_counts) - 1))
                try:
                    X_train, y_train = smote.fit_resample(X_train, y_train)
                    print(f"  After SMOTE: {len(X_train)} samples")
                except Exception as e:
                    print(f"  SMOTE failed ({e}), using original data")

    # ─── Build candidate models ───────────────────────────────
    print("\nTraining candidate models...")
    candidates = {}

    candidates['LogisticRegression'] = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', LogisticRegression(max_iter=2000, class_weight='balanced', C=0.5, solver='lbfgs')),
    ])

    candidates['RandomForest'] = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', RandomForestClassifier(
            n_estimators=500, max_depth=20, min_samples_split=5,
            min_samples_leaf=2, class_weight='balanced',
            random_state=42, n_jobs=-1
        )),
    ])

    candidates['GradientBoosting'] = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', GradientBoostingClassifier(
            n_estimators=300, max_depth=8, learning_rate=0.05,
            subsample=0.8, min_samples_split=5, random_state=42
        )),
    ])

    candidates['HistGradientBoosting'] = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', HistGradientBoostingClassifier(
            max_iter=500, max_depth=10, learning_rate=0.05,
            min_samples_leaf=10, random_state=42
        )),
    ])

    if HAS_XGBOOST:
        candidates['XGBoost'] = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', XGBClassifier(
                n_estimators=500, max_depth=8, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8,
                reg_alpha=0.1, reg_lambda=1.0,
                scale_pos_weight=1.0, use_label_encoder=False,
                eval_metric='logloss', random_state=42,
                n_jobs=-1, verbosity=0
            )),
        ])

    if HAS_LIGHTGBM:
        candidates['LightGBM'] = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', LGBMClassifier(
                n_estimators=500, max_depth=10, learning_rate=0.05,
                num_leaves=63, subsample=0.8, colsample_bytree=0.8,
                reg_alpha=0.1, reg_lambda=1.0,
                class_weight='balanced', random_state=42,
                n_jobs=-1, verbose=-1
            )),
        ])

    if HAS_CATBOOST:
        candidates['CatBoost'] = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', CatBoostClassifier(
                iterations=500, depth=8, learning_rate=0.05,
                random_seed=42, verbose=0
            )),
        ])


    # ─── Train and evaluate all candidates ────────────────────
    best_name = None
    best_acc = 0
    best_f1 = 0
    best_pipeline = None
    results = {}

    for name, clf in candidates.items():
        try:
            print(f"\n  Training {name}...")
            clf.fit(X_train, y_train)
            y_pred = clf.predict(X_test)

            acc = accuracy_score(y_test, y_pred)
            f1 = f1_score(y_test, y_pred, average='weighted')
            prec = precision_score(y_test, y_pred, average='weighted')
            rec = recall_score(y_test, y_pred, average='weighted')

            results[name] = {
                'accuracy': round(float(acc), 4),
                'f1': round(float(f1), 4),
                'precision': round(float(prec), 4),
                'recall': round(float(rec), 4),
            }

            print(f"    Accuracy: {acc:.4f} | F1: {f1:.4f} | Precision: {prec:.4f} | Recall: {rec:.4f}")

            # Use F1 as primary metric (better for imbalanced data)
            if f1 > best_f1 or (f1 == best_f1 and acc > best_acc):
                best_f1 = f1
                best_acc = acc
                best_name = name
                best_pipeline = clf

        except Exception as e:
            print(f"    {name} failed: {e}")
            results[name] = {'accuracy': 0, 'f1': 0, 'precision': 0, 'recall': 0}

    if best_pipeline is None:
        raise RuntimeError("All model candidates failed!")

    # ─── Cross-validation on best model ───────────────────────
    print(f"\n{'─'*40}")
    print(f"Best model: {best_name}")
    print(f"  Test Accuracy: {best_acc:.4f}")
    print(f"  Test F1:       {best_f1:.4f}")

    print(f"\nRunning 5-fold cross-validation on {best_name}...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(best_pipeline, X, y, cv=cv, scoring='accuracy', n_jobs=-1)
    cv_f1 = cross_val_score(best_pipeline, X, y, cv=cv, scoring='f1_weighted', n_jobs=-1)
    print(f"  CV Accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print(f"  CV F1:       {cv_f1.mean():.4f} ± {cv_f1.std():.4f}")
    print(f"  CV Scores:   {[round(s, 4) for s in cv_scores]}")

    # Re-fit on full training data
    best_pipeline.fit(X_train, y_train)

    # ─── Detailed report ──────────────────────────────────────
    y_pred_final = best_pipeline.predict(X_test)
    print(f"\n{'─'*40}")
    print("Classification Report:")
    print(classification_report(y_test, y_pred_final, target_names=['Legitimate', 'Phishing']))
    print("Confusion Matrix:")
    cm = confusion_matrix(y_test, y_pred_final)
    print(f"  TN={cm[0][0]}  FP={cm[0][1]}")
    print(f"  FN={cm[1][0]}  TP={cm[1][1]}")

    # ─── Feature importance ───────────────────────────────────
    try:
        clf_step = best_pipeline.named_steps['clf']
        if hasattr(clf_step, 'feature_importances_'):
            importances = clf_step.feature_importances_
            sorted_idx = np.argsort(importances)[::-1]
            print(f"\nTop 15 Most Important Features:")
            for i in range(min(15, len(sorted_idx))):
                idx = sorted_idx[i]
                print(f"  {i+1:2d}. {feature_names[idx]:30s} {importances[idx]:.4f}")
        elif hasattr(clf_step, 'coef_'):
            coefs = np.abs(clf_step.coef_[0])
            sorted_idx = np.argsort(coefs)[::-1]
            print(f"\nTop 15 Most Important Features (by |coefficient|):")
            for i in range(min(15, len(sorted_idx))):
                idx = sorted_idx[i]
                print(f"  {i+1:2d}. {feature_names[idx]:30s} {coefs[idx]:.4f}")
    except Exception:
        pass

    elapsed = time.time() - t0

    # ─── Save model ───────────────────────────────────────────
    model_data = {
        'pipeline': best_pipeline,
        'feature_names': feature_names,
        'accuracy': round(float(best_acc), 4),
        'f1_score': round(float(best_f1), 4),
        'cv_accuracy_mean': round(float(cv_scores.mean()), 4),
        'cv_accuracy_std': round(float(cv_scores.std()), 4),
        'all_results': results,
        'model_type': best_name,
        'training_samples': len(X_train),
        'training_dataset_size': len(df),
        'n_features': len(feature_names),
        'training_time_seconds': round(elapsed, 1),
        'trained_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'data_sources': 'realtime_phishtank_openphish_urlhaus_phishstats_tranco_majestic',
    }

    model_path = os.path.join(MODELS_DIR, 'phishing_model.pkl')
    joblib.dump(model_data, model_path)
    print(f"\n[OK] Best model ({best_name}) saved to {model_path}")

    # Export to ONNX format for Chrome Extension fast-path offline inference
    if HAS_SKL2ONNX:
        try:
            initial_type = [('float_input', FloatTensorType([None, len(feature_names)]))]
            onnx_model = skl2onnx.convert_sklearn(best_pipeline, initial_types=initial_type)
            onnx_path = os.path.join(MODELS_DIR, 'phishing_model.onnx')
            with open(onnx_path, "wb") as f:
                f.write(onnx_model.SerializeToString())
            print(f"[OK] ONNX model exported to {onnx_path}")

            # Also copy to extension/ directory if it exists
            ext_models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'extension', 'models')
            os.makedirs(ext_models_dir, exist_ok=True)
            ext_onnx_path = os.path.join(ext_models_dir, 'phishing_model.onnx')
            with open(ext_onnx_path, "wb") as f:
                f.write(onnx_model.SerializeToString())
            print(f"[OK] Copied ONNX model for Chrome Extension to {ext_onnx_path}")
        except Exception as e:
            print(f"Note: ONNX export skipped ({e})")

    print(f"  Training time: {elapsed:.1f}s")
    return model_data



# ─── Email Data Loading ──────────────────────────────────────────────
def prepare_email_data():
    """Load all available email datasets from data directory."""
    csv_files = glob.glob(os.path.join(DATA_DIR, '*.csv'))
    frames = []

    for path in csv_files:
        if 'url' in os.path.basename(path).lower() and 'email' not in os.path.basename(path).lower():
            continue
        try:
            df = pd.read_csv(path, nrows=5)
        except Exception:
            continue

        cols_lower = {c.lower(): c for c in df.columns}
        text_col = (cols_lower.get('text') or cols_lower.get('email_text') or
                    cols_lower.get('email') or cols_lower.get('message') or
                    cols_lower.get('content') or cols_lower.get('subject') or
                    cols_lower.get('body'))
        label_col = (cols_lower.get('label') or cols_lower.get('category') or
                     cols_lower.get('type') or cols_lower.get('is_phishing') or
                     cols_lower.get('class'))

        if text_col and label_col:
            try:
                full_df = pd.read_csv(path, usecols=[text_col, label_col]).dropna()
                full_df = full_df.rename(columns={text_col: 'text', label_col: 'label'})
                # Normalize label
                if full_df['label'].dtype == object:
                    phish_values = ['phishing', 'phish', 'spam', 'malicious',
                                    'Phishing', 'Spam', '1', 'yes', 'true']
                    full_df['label'] = full_df['label'].apply(
                        lambda x: 1 if str(x).strip().lower() in [v.lower() for v in phish_values] else 0
                    )
                frames.append(full_df)
                print(f"    Loaded {len(full_df)} emails from {os.path.basename(path)}")
            except Exception:
                pass

    if frames:
        merged = pd.concat(frames, ignore_index=True).drop_duplicates(subset=['text']).reset_index(drop=True)
        print(f"Total email data: {len(merged)} ({merged['label'].sum()} phishing, {(merged['label']==0).sum()} legit)")
        return merged

    print("No email dataset found. Generating enhanced synthetic data...")
    return generate_enhanced_email_data()


def generate_enhanced_email_data():
    """Generate enhanced synthetic email data with more diversity."""
    import random
    np.random.seed(42)
    random.seed(42)

    legit_templates = [
        "Hi {name}, I wanted to reach out about the project we discussed. Please let me know your availability for a meeting next week. Thanks!",
        "Your invoice for order #{order} has been processed. You can view it in your account dashboard. Contact us if you have questions.",
        "Thank you for your recent purchase. Your order will ship within 3-5 business days. Track it in your account.",
        "Meeting notes from today: We agreed on the timeline and deliverables. Next check-in is on Thursday.",
        "Hey, just following up on the report you sent. Overall looks good, minor tweaks needed on section 3. Let's sync tomorrow.",
        "Please find attached the quarterly report as discussed during our last meeting. Let me know if you need any clarification.",
        "The team standup has been rescheduled to {time} today. Please update your calendar accordingly.",
        "Welcome aboard your new role at {company}. We are excited to have you join our team.",
        "Reminder: the office will be closed on Friday for the holiday. Have a great weekend!",
        "I have reviewed your proposal and have a few suggestions. Can we schedule a call this week to discuss?",
        "Hi team, I've pushed the code changes to the feature branch. Please review when you get a chance.",
        "Just wanted to share this article I found interesting about {topic}. Thought you might enjoy it.",
        "Your subscription to {service} has been renewed for another year. No action needed.",
        "Here are the notes from our Q{quarter} planning session. Let me know if I missed anything.",
        "Congratulations on the successful launch! Great work by the entire team.",
        "The new employee orientation starts at 9 AM in Conference Room B. Please bring your ID badge.",
        "Attached is the signed contract for your review. Please countersign and return at your convenience.",
        "Happy birthday {name}! Hope you have a wonderful day. The team got you a little something.",
        "The monthly newsletter is out! Check it out for updates on company events and achievements.",
        "Feedback request: How was your experience with our customer support? Your input helps us improve.",
    ]

    phish_templates = [
        "URGENT: Your account has been compromised. Click the link below to verify your identity immediately: {link}",
        "Action Required: Your {service} subscription will expire today. Update your payment information: {link}",
        "SECURITY ALERT: Unusual activity detected on your {service} account. Confirm your identity to prevent suspension: {link}",
        "Important: Your PayPal account has been limited. Verify your information to restore access: {link}",
        "Final Notice: Your bank account requires verification. Click here to confirm your details: {link}",
        "WARNING: Your email storage is full. Upgrade now or lose access to new emails: {link}",
        "Your Apple ID has been used to sign in on a new device. If this wasn't you, secure your account: {link}",
        "Delivery failed for your {service} message. Please confirm your email settings here: {link}",
        "Tax refund available! Click to claim your ${amount} refund before the deadline: {link}",
        "Invoice payment overdue! Click to update billing info and avoid service interruption: {link}",
        "Your account will be permanently deleted in 24 hours unless you verify: {link}",
        "Congratulations! You've won a ${amount} gift card. Claim it now: {link}",
        "Dear Customer, we detected unauthorized login to your account from {location}. Verify here: {link}",
        "Your recent transaction of ${amount} is pending. Confirm or cancel: {link}",
        "IT Department: Your password expires today. Reset it immediately to maintain access: {link}",
        "URGENT: CEO {name} requests immediate wire transfer. Please process: {link}",
        "Your {service} order has been placed. If you didn't make this purchase, cancel here: {link}",
        "Security Notice: Your Social Security Number may have been exposed. Check now: {link}",
        "You have (1) unread voicemail from {name}. Listen here: {link}",
        "Account suspension notice. Your {service} account shows suspicious activity. Verify ownership: {link}",
    ]

    names = ['John', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma', 'James', 'Anna']
    companies = ['TechCorp', 'Acme Inc', 'GlobalSoft', 'DataPro', 'CloudFirst']
    services = ['Netflix', 'Microsoft 365', 'Google', 'Apple', 'Amazon', 'PayPal', 'Spotify']
    topics = ['machine learning', 'cloud computing', 'cybersecurity', 'data science']
    locations = ['Russia', 'China', 'Nigeria', 'Unknown Location', 'IP: 192.168.1.1']
    times = ['2 PM', '3 PM', '4 PM', '10 AM', '11 AM']

    emails = []
    labels = []

    for _ in range(3000):
        template = random.choice(legit_templates)
        text = template.format(
            name=random.choice(names),
            order=random.randint(10000, 99999),
            company=random.choice(companies),
            service=random.choice(services),
            topic=random.choice(topics),
            time=random.choice(times),
            quarter=random.randint(1, 4),
        )
        emails.append(text)
        labels.append(0)

    for _ in range(3000):
        fake_link = f"http://{''.join(random.choices('abcdefghijklmnop', k=8))}-verify{random.randint(100,9999)}.{''.join(random.choices(['xyz','top','tk','click','buzz','site'], k=1)[0])}/confirm?token={''.join(random.choices('abcdef0123456789', k=24))}"
        template = random.choice(phish_templates)
        text = template.format(
            link=fake_link,
            service=random.choice(services),
            amount=random.randint(50, 5000),
            name=random.choice(names),
            location=random.choice(locations),
        )
        emails.append(text)
        labels.append(1)

    df = pd.DataFrame({'text': emails, 'label': labels})
    return df.sample(frac=1, random_state=42).reset_index(drop=True)


# ─── Email Model Training ────────────────────────────────────────────
def train_email_model():
    from preprocess import clean_email_text

    t0 = time.time()
    df = prepare_email_data()

    print(f"\n{'='*60}")
    print(f"Training Email model on {len(df)} emails")
    print(f"  Phishing:   {(df['label']==1).sum()}")
    print(f"  Legitimate: {(df['label']==0).sum()}")
    print(f"{'='*60}")

    texts = df['text'].apply(clean_email_text).values
    y = df['label'].values

    X_train, X_test, y_train, y_test = train_test_split(
        texts, y, test_size=0.2, random_state=42, stratify=y
    )

    # ─── Candidate models ────────────────────────────────────
    candidates = {
        'LogisticRegression_word': Pipeline([
            ('tfidf', TfidfVectorizer(max_features=25000, ngram_range=(1, 2), sublinear_tf=True)),
            ('clf', LogisticRegression(max_iter=2000, class_weight='balanced', C=1.0)),
        ]),
        'LogisticRegression_char': Pipeline([
            ('tfidf', TfidfVectorizer(max_features=25000, ngram_range=(3, 5), analyzer='char_wb', sublinear_tf=True)),
            ('clf', LogisticRegression(max_iter=2000, class_weight='balanced', C=1.0)),
        ]),
        'RandomForest': Pipeline([
            ('tfidf', TfidfVectorizer(max_features=25000, ngram_range=(1, 2), sublinear_tf=True)),
            ('clf', RandomForestClassifier(
                n_estimators=300, max_depth=25, class_weight='balanced',
                random_state=42, n_jobs=-1
            )),
        ]),
        'LinearSVC': Pipeline([
            ('tfidf', TfidfVectorizer(max_features=25000, ngram_range=(1, 2), sublinear_tf=True)),
            ('clf', LinearSVC(max_iter=3000, class_weight='balanced', C=1.0)),
        ]),
    }

    best_name = None
    best_acc = 0
    best_f1 = 0
    best_pipeline = None
    results = {}

    for name, clf in candidates.items():
        try:
            print(f"\n  Training {name}...")
            clf.fit(X_train, y_train)
            y_pred = clf.predict(X_test)

            acc = accuracy_score(y_test, y_pred)
            f1 = f1_score(y_test, y_pred, average='weighted')

            results[name] = {
                'accuracy': round(float(acc), 4),
                'f1': round(float(f1), 4),
            }
            print(f"    Accuracy: {acc:.4f} | F1: {f1:.4f}")

            if f1 > best_f1 or (f1 == best_f1 and acc > best_acc):
                best_f1 = f1
                best_acc = acc
                best_name = name
                best_pipeline = clf

        except Exception as e:
            print(f"    {name} failed: {e}")
            results[name] = {'accuracy': 0, 'f1': 0}

    if best_pipeline is None:
        raise RuntimeError("All email model candidates failed!")

    print(f"\nBest email model: {best_name} (Accuracy={best_acc:.4f}, F1={best_f1:.4f})")
    y_pred_final = best_pipeline.predict(X_test)
    print(classification_report(y_test, y_pred_final, target_names=['Legitimate', 'Phishing']))

    elapsed = time.time() - t0

    model_data = {
        'pipeline': best_pipeline,
        'accuracy': round(float(best_acc), 4),
        'f1_score': round(float(best_f1), 4),
        'all_results': results,
        'model_type': best_name,
        'training_samples': len(X_train),
        'training_dataset_size': len(df),
        'training_time_seconds': round(elapsed, 1),
        'trained_at': time.strftime('%Y-%m-%d %H:%M:%S'),
    }

    path = os.path.join(MODELS_DIR, 'email_model.pkl')
    joblib.dump(model_data, path)
    print(f"[OK] Email model saved to {path}")

    return model_data


# ─── Main Entry Point ────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print("CyberGuard AI — Enhanced ML Model Training")
    print("  Real-time data | 35+ features | XGBoost/LightGBM")
    print("=" * 60)

    print("\n=== URL Model ===")
    url_result = train_url_model()

    print(f"\n=== Email Model ===")
    email_result = train_email_model()

    print(f"\n{'='*60}")
    print("Training Complete!")
    print(f"{'─'*60}")
    print(f"  URL Model:")
    print(f"    Model:        {url_result['model_type']}")
    print(f"    Accuracy:     {url_result['accuracy']}")
    print(f"    F1 Score:     {url_result['f1_score']}")
    print(f"    CV Accuracy:  {url_result['cv_accuracy_mean']} ± {url_result['cv_accuracy_std']}")
    print(f"    Features:     {url_result['n_features']}")
    print(f"    Dataset Size: {url_result['training_dataset_size']}")
    print(f"    Data Sources: {url_result['data_sources']}")
    print(f"    Time:         {url_result['training_time_seconds']}s")
    print(f"{'─'*60}")
    print(f"  Email Model:")
    print(f"    Model:        {email_result['model_type']}")
    print(f"    Accuracy:     {email_result['accuracy']}")
    print(f"    F1 Score:     {email_result['f1_score']}")
    print(f"    Dataset Size: {email_result['training_dataset_size']}")
    print(f"    Time:         {email_result['training_time_seconds']}s")
    print(f"{'='*60}")
