"""
Fine-tune DistilBERT Transformers for Phishing Detection (URL + Email).

This script runs LOCALLY (not on HF Spaces) and produces model weights that
are committed to the repo and deployed on HF Spaces.

Tasks:
  1. URL Phishing Transformer  — classifies raw URL strings
  2. Email Phishing Transformer — classifies email subject + body text

Each task:
  - Downloads distilbert-base-uncased
  - Fine-tunes on domain data from train.py data loaders
  - Saves PyTorch weights to models/finetuned_<task>_transformer/
  - Exports quantized ONNX to models/<task>_transformer.onnx

Usage:
  pip install -r requirements.txt   # needs torch + transformers
  python finetune_transformer.py          # fine-tune both
  python finetune_transformer.py --url    # URL only
  python finetune_transformer.py --email  # email only
"""

import os
import sys
import time
import argparse
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

# ── Check dependencies ────────────────────────────────────────────────
try:
    import torch
    from torch.utils.data import Dataset, DataLoader
    from transformers import (
        AutoTokenizer,
        AutoModelForSequenceClassification,
        get_linear_schedule_with_warmup,
    )
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    print("ERROR: PyTorch + Transformers required.  pip install torch transformers")

try:
    import onnxruntime as ort
    HAS_ORT = True
except ImportError:
    HAS_ORT = False

# ── Paths ─────────────────────────────────────────────────────────────
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

BASE_MODEL = "distilbert-base-uncased"

URL_OUTPUT_DIR  = os.path.join(MODELS_DIR, "finetuned_url_transformer")
URL_ONNX_PATH   = os.path.join(MODELS_DIR, "url_transformer.onnx")

EMAIL_OUTPUT_DIR = os.path.join(MODELS_DIR, "finetuned_email_transformer")
EMAIL_ONNX_PATH  = os.path.join(MODELS_DIR, "email_transformer.onnx")


# ── Dataset wrapper ───────────────────────────────────────────────────
class TextClassificationDataset(Dataset):
    """Tokenised text → { input_ids, attention_mask, labels }."""

    def __init__(self, texts, labels, tokenizer, max_length=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        enc = self.tokenizer(
            str(self.texts[idx]),
            truncation=True,
            max_length=self.max_length,
            padding='max_length',
            return_tensors='pt',
        )
        item = {k: v.squeeze(0) for k, v in enc.items()}
        item['labels'] = torch.tensor(int(self.labels[idx]), dtype=torch.long)
        return item


# ── Generic fine-tune loop ────────────────────────────────────────────
def _fine_tune(
    task_name: str,
    texts: np.ndarray,
    labels: np.ndarray,
    output_dir: str,
    onnx_path: str,
    epochs: int = 3,
    batch_size: int = 16,
    lr: float = 2e-5,
    max_length: int = 128,
):
    """Fine-tune DistilBERT on a binary classification task."""
    if not HAS_TORCH:
        raise RuntimeError("PyTorch + HuggingFace transformers required!")

    t0 = time.time()
    print("=" * 60)
    print(f"CyberGuard AI — Fine-Tuning: {task_name}")
    print(f"  Base model : {BASE_MODEL}")
    print(f"  Samples    : {len(texts)}")
    print(f"  Epochs     : {epochs}")
    print(f"  Batch size : {batch_size}")
    print("=" * 60)

    # Shuffle & split 80/20
    idx = np.random.RandomState(42).permutation(len(texts))
    texts, labels = texts[idx], labels[idx]
    split = int(len(texts) * 0.8)
    train_texts, val_texts = texts[:split], texts[split:]
    train_labels, val_labels = labels[:split], labels[split:]

    # Tokenizer & model
    print(f"\n[Model] Loading {BASE_MODEL}...")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL,
        num_labels=2,
        id2label={0: "legitimate", 1: "phishing"},
        label2id={"legitimate": 0, "phishing": 1},
    )

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"  Device: {device}")
    model.to(device)

    # Data loaders
    train_ds = TextClassificationDataset(train_texts, train_labels, tokenizer, max_length)
    val_ds   = TextClassificationDataset(val_texts, val_labels, tokenizer, max_length)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader   = DataLoader(val_ds,   batch_size=batch_size, shuffle=False)

    # Optimizer & scheduler
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    total_steps = len(train_loader) * epochs
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=int(total_steps * 0.1),
        num_training_steps=total_steps,
    )

    # Training loop
    print(f"\n[Training] {epochs} epoch(s), {len(train_loader)} batches/epoch")
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for step, batch in enumerate(train_loader):
            input_ids      = batch['input_ids'].to(device)
            attention_mask  = batch['attention_mask'].to(device)
            batch_labels    = batch['labels'].to(device)

            optimizer.zero_grad()
            out = model(input_ids=input_ids, attention_mask=attention_mask, labels=batch_labels)
            loss = out.loss
            total_loss += loss.item()

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()

            if (step + 1) % 50 == 0 or (step + 1) == len(train_loader):
                print(f"  Epoch {epoch+1}/{epochs}  Step {step+1}/{len(train_loader)}  Loss: {loss.item():.4f}")

        print(f"  Epoch {epoch+1} avg loss: {total_loss / len(train_loader):.4f}")

    # Validation
    print("\n[Eval] Validating...")
    model.eval()
    preds, targets = [], []
    with torch.no_grad():
        for batch in val_loader:
            input_ids     = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            logits = model(input_ids=input_ids, attention_mask=attention_mask).logits
            preds.extend(torch.argmax(logits, dim=1).cpu().numpy())
            targets.extend(batch['labels'].numpy())

    acc = np.mean(np.array(preds) == np.array(targets))
    print(f"  Validation Accuracy: {acc:.4f} ({acc*100:.2f}%)")

    # Save PyTorch model + tokenizer
    os.makedirs(output_dir, exist_ok=True)
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"\n[Save] PyTorch model → {output_dir}")

    # ONNX export
    _export_onnx(model, tokenizer, device, onnx_path, max_length)

    elapsed = time.time() - t0
    print(f"\n{'='*60}")
    print(f"{task_name} fine-tuning complete in {elapsed:.1f}s  (acc={acc*100:.2f}%)")
    print(f"{'='*60}\n")

    return {
        "task": task_name,
        "accuracy": round(float(acc), 4),
        "output_dir": output_dir,
        "onnx_path": onnx_path,
        "training_time": round(elapsed, 1),
    }


def _export_onnx(model, tokenizer, device, onnx_path, max_length=128):
    """Export model to ONNX format."""
    print(f"[ONNX] Exporting to {onnx_path}...")
    try:
        model.eval()
        dummy = tokenizer(
            "http://example.com/verify-account",
            max_length=max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt',
        )
        dummy = {k: v.to(device) for k, v in dummy.items()}

        torch.onnx.export(
            model,
            (dummy['input_ids'], dummy['attention_mask']),
            onnx_path,
            input_names=['input_ids', 'attention_mask'],
            output_names=['logits'],
            dynamic_axes={
                'input_ids':      {0: 'batch', 1: 'seq'},
                'attention_mask': {0: 'batch', 1: 'seq'},
                'logits':         {0: 'batch'},
            },
            opset_version=14,
        )
        print(f"[OK] ONNX exported ({os.path.getsize(onnx_path) / 1e6:.1f} MB)")
    except Exception as e:
        print(f"[WARN] ONNX export failed: {e}")


# ── URL Fine-Tuning ──────────────────────────────────────────────────
def fine_tune_url_transformer(epochs=3, batch_size=16, lr=2e-5):
    """
    Fine-tune DistilBERT on raw URL strings for phishing detection.

    DistilBERT's WordPiece tokenizer naturally splits URLs into meaningful
    subword tokens: 'http', '://', 'pay', '##pal', '-', 'login', '.', 'xyz'
    This captures brand impersonation, suspicious TLDs, and obfuscation
    patterns without manual feature engineering.
    """
    from train import prepare_url_data

    print("\n[Data] Loading URL training data...")
    df = prepare_url_data()
    print(f"  {len(df)} URLs  ({(df['label']==1).sum()} phishing, {(df['label']==0).sum()} legit)")

    return _fine_tune(
        task_name="URL Phishing Transformer",
        texts=df['url'].values,
        labels=df['label'].values,
        output_dir=URL_OUTPUT_DIR,
        onnx_path=URL_ONNX_PATH,
        epochs=epochs,
        batch_size=batch_size,
        lr=lr,
        max_length=128,  # URLs rarely exceed 128 tokens
    )


# ── Email Fine-Tuning ────────────────────────────────────────────────
def fine_tune_email_transformer(epochs=3, batch_size=16, lr=2e-5):
    """
    Fine-tune DistilBERT on email text (subject + body) for phishing detection.
    """
    from train import prepare_email_data

    print("\n[Data] Loading email training data...")
    df = prepare_email_data()
    print(f"  {len(df)} emails  ({(df['label']==1).sum()} phishing, {(df['label']==0).sum()} legit)")

    # Combine subject-like prefix if present; otherwise just use text
    texts = df['text'].values

    return _fine_tune(
        task_name="Email Phishing Transformer",
        texts=texts,
        labels=df['label'].values,
        output_dir=EMAIL_OUTPUT_DIR,
        onnx_path=EMAIL_ONNX_PATH,
        epochs=epochs,
        batch_size=batch_size,
        lr=lr,
        max_length=256,  # emails can be longer
    )


# ── CLI ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Fine-tune Transformers for CyberGuard AI")
    parser.add_argument('--url',   action='store_true', help='Fine-tune URL model only')
    parser.add_argument('--email', action='store_true', help='Fine-tune Email model only')
    parser.add_argument('--epochs', type=int, default=3)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--lr', type=float, default=2e-5)
    args = parser.parse_args()

    run_both = not args.url and not args.email  # default: run both

    results = []
    if args.url or run_both:
        results.append(fine_tune_url_transformer(args.epochs, args.batch_size, args.lr))
    if args.email or run_both:
        results.append(fine_tune_email_transformer(args.epochs, args.batch_size, args.lr))

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    for r in results:
        print(f"  {r['task']}: accuracy={r['accuracy']*100:.2f}%  time={r['training_time']}s")
        print(f"    PyTorch: {r['output_dir']}")
        print(f"    ONNX:    {r['onnx_path']}")
    print("=" * 60)
