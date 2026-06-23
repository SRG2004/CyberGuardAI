"""
Fetch real-time phishing and legitimate URL data from trusted public sources.

Sources (phishing / malicious):
  - PhishTank   — verified community-reported phishing URLs
  - OpenPhish   — curated phishing feed
  - URLhaus     — malware distribution URLs (abuse.ch)
  - PhishStats  — phishing URLs with confidence scores

Sources (legitimate / negative samples):
  - Tranco List — research-grade top domains ranking
  - Majestic    — top 1M domains by backlink profile

All sources are free and require no API keys.
"""

import os
import io
import time
import hashlib
import zipfile
import bz2
import csv
import pandas as pd
import numpy as np
import requests
import warnings
warnings.filterwarnings('ignore')

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
CACHE_DIR = os.path.join(DATA_DIR, '.cache')
os.makedirs(CACHE_DIR, exist_ok=True)

CACHE_TTL = 24 * 3600  # 24 hours

HEADERS = {
    'User-Agent': 'CyberGuardAI-MLTrainer/1.0 (security research; phishing detection model training)',
    'Accept': 'text/csv, text/plain, application/octet-stream, */*',
}


# ─── Cache helpers ────────────────────────────────────────────────────
def _cache_path(name: str) -> str:
    return os.path.join(CACHE_DIR, f'{name}.csv')

def _cache_ts_path(name: str) -> str:
    return os.path.join(CACHE_DIR, f'{name}.ts')

def _is_cache_valid(name: str) -> bool:
    ts_path = _cache_ts_path(name)
    if not os.path.exists(ts_path) or not os.path.exists(_cache_path(name)):
        return False
    try:
        with open(ts_path, 'r') as f:
            ts = float(f.read().strip())
        return (time.time() - ts) < CACHE_TTL
    except Exception:
        return False

def _write_cache(name: str, df: pd.DataFrame):
    df.to_csv(_cache_path(name), index=False)
    with open(_cache_ts_path(name), 'w') as f:
        f.write(str(time.time()))

def _read_cache(name: str) -> pd.DataFrame | None:
    try:
        return pd.read_csv(_cache_path(name))
    except Exception:
        return None


# ─── PhishTank ────────────────────────────────────────────────────────
def fetch_phishtank() -> pd.DataFrame:
    """Fetch verified phishing URLs from PhishTank (bz2-compressed CSV)."""
    name = 'phishtank'
    if _is_cache_valid(name):
        cached = _read_cache(name)
        if cached is not None and len(cached) > 0:
            print(f"  [PhishTank] Using cached data: {len(cached)} URLs")
            return cached

    urls_to_try = [
        'http://data.phishtank.com/data/online-valid.csv.bz2',
        'http://data.phishtank.com/data/online-valid.csv',
    ]

    for url in urls_to_try:
        try:
            print(f"  [PhishTank] Downloading from {url}...")
            resp = requests.get(url, headers=HEADERS, timeout=120, stream=True)
            resp.raise_for_status()

            if url.endswith('.bz2'):
                raw = bz2.decompress(resp.content)
                df = pd.read_csv(io.BytesIO(raw), usecols=['url'], on_bad_lines='skip')
            else:
                df = pd.read_csv(io.BytesIO(resp.content), usecols=['url'], on_bad_lines='skip')

            df = df.dropna(subset=['url']).drop_duplicates(subset=['url'])
            df['label'] = 1
            df = df[['url', 'label']]
            _write_cache(name, df)
            print(f"  [PhishTank] Fetched {len(df)} phishing URLs")
            return df
        except Exception as e:
            print(f"  [PhishTank] Failed ({url}): {e}")
            continue

    # Return empty if all fail
    print("  [PhishTank] All sources failed")
    return pd.DataFrame(columns=['url', 'label'])


# ─── OpenPhish ────────────────────────────────────────────────────────
def fetch_openphish() -> pd.DataFrame:
    """Fetch phishing URLs from OpenPhish community feed."""
    name = 'openphish'
    if _is_cache_valid(name):
        cached = _read_cache(name)
        if cached is not None and len(cached) > 0:
            print(f"  [OpenPhish] Using cached data: {len(cached)} URLs")
            return cached

    try:
        print("  [OpenPhish] Downloading feed...")
        resp = requests.get('https://openphish.com/feed.txt', headers=HEADERS, timeout=60)
        resp.raise_for_status()

        urls = [line.strip() for line in resp.text.strip().split('\n') if line.strip().startswith('http')]
        df = pd.DataFrame({'url': urls, 'label': 1})
        df = df.drop_duplicates(subset=['url'])
        _write_cache(name, df)
        print(f"  [OpenPhish] Fetched {len(df)} phishing URLs")
        return df
    except Exception as e:
        print(f"  [OpenPhish] Failed: {e}")
        return pd.DataFrame(columns=['url', 'label'])


# ─── URLhaus (abuse.ch) ──────────────────────────────────────────────
def fetch_urlhaus() -> pd.DataFrame:
    """Fetch malware distribution URLs from URLhaus."""
    name = 'urlhaus'
    if _is_cache_valid(name):
        cached = _read_cache(name)
        if cached is not None and len(cached) > 0:
            print(f"  [URLhaus] Using cached data: {len(cached)} URLs")
            return cached

    try:
        print("  [URLhaus] Downloading recent URLs...")
        resp = requests.get(
            'https://urlhaus.abuse.ch/downloads/csv_recent/',
            headers=HEADERS, timeout=120
        )
        resp.raise_for_status()

        # URLhaus CSV has comment lines starting with #
        lines = resp.text.strip().split('\n')
        data_lines = [l for l in lines if not l.startswith('#') and l.strip()]

        if data_lines:
            reader = csv.reader(io.StringIO('\n'.join(data_lines)))
            urls = []
            for row in reader:
                if len(row) >= 3:
                    url = row[2].strip().strip('"')
                    if url.startswith('http'):
                        urls.append(url)

            df = pd.DataFrame({'url': urls, 'label': 1})
            df = df.drop_duplicates(subset=['url'])
            _write_cache(name, df)
            print(f"  [URLhaus] Fetched {len(df)} malicious URLs")
            return df
    except Exception as e:
        print(f"  [URLhaus] Failed: {e}")

    return pd.DataFrame(columns=['url', 'label'])


# ─── PhishStats ───────────────────────────────────────────────────────
def fetch_phishstats() -> pd.DataFrame:
    """Fetch phishing URLs from PhishStats (high-confidence only)."""
    name = 'phishstats'
    if _is_cache_valid(name):
        cached = _read_cache(name)
        if cached is not None and len(cached) > 0:
            print(f"  [PhishStats] Using cached data: {len(cached)} URLs")
            return cached

    try:
        print("  [PhishStats] Downloading phishing scores...")
        resp = requests.get(
            'https://phishstats.info/phish_score.csv',
            headers=HEADERS, timeout=120
        )
        resp.raise_for_status()

        # PhishStats CSV: first few lines are comments
        lines = resp.text.strip().split('\n')
        data_lines = [l for l in lines if not l.startswith('#') and l.strip()]

        if data_lines:
            df = pd.read_csv(
                io.StringIO('\n'.join(data_lines)),
                header=None,
                names=['date', 'score', 'url', 'ip'],
                on_bad_lines='skip'
            )
            # Keep only high-confidence phishing (score >= 5)
            df = df[df['score'].apply(lambda x: _safe_float(x, 0) >= 5)]
            df = df[df['url'].str.startswith('http', na=False)]
            df = df[['url']].drop_duplicates()
            df['label'] = 1
            _write_cache(name, df)
            print(f"  [PhishStats] Fetched {len(df)} phishing URLs (score >= 5)")
            return df
    except Exception as e:
        print(f"  [PhishStats] Failed: {e}")

    return pd.DataFrame(columns=['url', 'label'])


def _safe_float(v, default=0.0):
    try:
        return float(v)
    except (ValueError, TypeError):
        return default


# ─── Tranco List (legitimate domains) ────────────────────────────────
def fetch_tranco_legitimate(max_domains=50000) -> pd.DataFrame:
    """Fetch top legitimate domains from Tranco list and generate full URLs."""
    name = 'tranco'
    if _is_cache_valid(name):
        cached = _read_cache(name)
        if cached is not None and len(cached) > 0:
            print(f"  [Tranco] Using cached data: {len(cached)} URLs")
            return cached

    try:
        print("  [Tranco] Downloading top domains list...")
        resp = requests.get(
            'https://tranco-list.eu/top-1m.csv.zip',
            headers=HEADERS, timeout=120
        )
        resp.raise_for_status()

        with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
            csv_name = z.namelist()[0]
            with z.open(csv_name) as f:
                df = pd.read_csv(f, header=None, names=['rank', 'domain'], nrows=max_domains)

        # Generate realistic URLs from top domains
        urls = []
        paths = ['', '/', '/about', '/login', '/products', '/help',
                 '/blog', '/contact', '/docs', '/api', '/support',
                 '/careers', '/news', '/pricing']

        np.random.seed(42)
        for domain in df['domain'].values:
            path = np.random.choice(paths)
            url = f"https://{domain}{path}"
            urls.append(url)

        result_df = pd.DataFrame({'url': urls, 'label': 0})
        result_df = result_df.drop_duplicates(subset=['url'])
        _write_cache(name, result_df)
        print(f"  [Tranco] Generated {len(result_df)} legitimate URLs from top domains")
        return result_df
    except Exception as e:
        print(f"  [Tranco] Failed: {e}")

    return pd.DataFrame(columns=['url', 'label'])


# ─── Majestic Million (additional legitimate domains) ─────────────────
def fetch_majestic_legitimate(max_domains=30000) -> pd.DataFrame:
    """Fetch top legitimate domains from Majestic Million."""
    name = 'majestic'
    if _is_cache_valid(name):
        cached = _read_cache(name)
        if cached is not None and len(cached) > 0:
            print(f"  [Majestic] Using cached data: {len(cached)} URLs")
            return cached

    try:
        print("  [Majestic] Downloading top domains...")
        resp = requests.get(
            'https://downloads.majestic.com/majestic_million.csv',
            headers=HEADERS, timeout=120
        )
        resp.raise_for_status()

        df = pd.read_csv(io.BytesIO(resp.content), nrows=max_domains)
        domain_col = None
        for col in df.columns:
            if 'domain' in col.lower():
                domain_col = col
                break

        if domain_col is None:
            domain_col = df.columns[2] if len(df.columns) > 2 else df.columns[0]

        paths = ['', '/', '/about', '/login', '/docs', '/blog', '/help', '/support']
        np.random.seed(43)
        urls = []
        for domain in df[domain_col].values:
            path = np.random.choice(paths)
            url = f"https://{domain}{path}"
            urls.append(url)

        result_df = pd.DataFrame({'url': urls, 'label': 0})
        result_df = result_df.drop_duplicates(subset=['url'])
        _write_cache(name, result_df)
        print(f"  [Majestic] Generated {len(result_df)} legitimate URLs from top domains")
        return result_df
    except Exception as e:
        print(f"  [Majestic] Failed: {e}")

    return pd.DataFrame(columns=['url', 'label'])


# ─── Main Aggregation ────────────────────────────────────────────────
def fetch_all_realtime_data(balance_classes=True, max_per_class=75000) -> pd.DataFrame:
    """
    Fetch and merge data from all sources.
    Returns a deduplicated, balanced DataFrame with columns ['url', 'label'].
    """
    print("=" * 60)
    print("Fetching real-time training data from trusted sources...")
    print("=" * 60)

    # Phishing sources
    phishing_frames = []
    for fetcher in [fetch_phishtank, fetch_openphish, fetch_urlhaus, fetch_phishstats]:
        try:
            df = fetcher()
            if df is not None and len(df) > 0:
                phishing_frames.append(df)
        except Exception as e:
            print(f"  Fetcher error: {e}")

    # Legitimate sources
    legit_frames = []
    for fetcher in [fetch_tranco_legitimate, fetch_majestic_legitimate]:
        try:
            df = fetcher()
            if df is not None and len(df) > 0:
                legit_frames.append(df)
        except Exception as e:
            print(f"  Fetcher error: {e}")

    # Merge
    all_frames = phishing_frames + legit_frames
    if not all_frames:
        print("WARNING: No real-time data could be fetched!")
        return pd.DataFrame(columns=['url', 'label'])

    merged = pd.concat(all_frames, ignore_index=True)
    merged = merged.dropna(subset=['url'])
    merged = merged.drop_duplicates(subset=['url']).reset_index(drop=True)

    n_phishing = (merged['label'] == 1).sum()
    n_legit = (merged['label'] == 0).sum()
    print(f"\nMerged dataset: {len(merged)} total URLs")
    print(f"  Phishing:   {n_phishing}")
    print(f"  Legitimate: {n_legit}")

    # Balance classes
    if balance_classes and n_phishing > 0 and n_legit > 0:
        target_size = min(max_per_class, max(n_phishing, n_legit))
        phishing_df = merged[merged['label'] == 1]
        legit_df = merged[merged['label'] == 0]

        # Oversample minority or undersample majority
        if len(phishing_df) < target_size:
            phishing_df = phishing_df.sample(n=min(target_size, len(phishing_df)), random_state=42)
        else:
            phishing_df = phishing_df.sample(n=target_size, random_state=42)

        if len(legit_df) < target_size:
            legit_df = legit_df.sample(n=min(target_size, len(legit_df)), random_state=42)
        else:
            legit_df = legit_df.sample(n=target_size, random_state=42)

        merged = pd.concat([phishing_df, legit_df], ignore_index=True)
        merged = merged.sample(frac=1, random_state=42).reset_index(drop=True)
        print(f"  Balanced to: {len(merged)} ({(merged['label']==1).sum()} phishing, {(merged['label']==0).sum()} legit)")

    # Save to disk
    output_path = os.path.join(DATA_DIR, 'realtime_phishing.csv')
    merged.to_csv(output_path, index=False)
    print(f"  Saved to: {output_path}")
    print("=" * 60)

    return merged


# ─── Fallback: load from existing files ──────────────────────────────
def load_existing_data() -> pd.DataFrame | None:
    """Load previously downloaded real-time data or any CSV in data dir."""
    realtime_path = os.path.join(DATA_DIR, 'realtime_phishing.csv')
    if os.path.exists(realtime_path):
        df = pd.read_csv(realtime_path)
        if 'url' in df.columns and 'label' in df.columns and len(df) > 1000:
            print(f"Loaded existing real-time dataset: {len(df)} URLs")
            return df

    # Fallback to url_phishing.csv
    csv_path = os.path.join(DATA_DIR, 'url_phishing.csv')
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
        if 'url' in df.columns and 'label' in df.columns:
            print(f"Loaded existing dataset: {len(df)} URLs (fallback)")
            return df

    return None


if __name__ == '__main__':
    df = fetch_all_realtime_data()
    if len(df) > 0:
        print(f"\nFinal dataset: {len(df)} URLs")
        print(f"  Phishing: {(df['label'] == 1).sum()}")
        print(f"  Legitimate: {(df['label'] == 0).sum()}")
        print(f"  Sample phishing URLs:")
        phish_sample = df[df['label'] == 1].head(5)
        for _, row in phish_sample.iterrows():
            print(f"    {row['url'][:80]}")
    else:
        print("No data fetched. Check network connectivity.")
