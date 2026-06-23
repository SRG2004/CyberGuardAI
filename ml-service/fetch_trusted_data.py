import csv
import io
import os
import tarfile
import tempfile
import urllib.error
import urllib.request
import zipfile
from email import policy
from email.parser import BytesParser


DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

PHISHTANK_CSV_GZ = 'http://data.phishtank.com/data/online-valid.csv.gz'
TRANCO_TOP_1M_ZIP = 'https://tranco-list.eu/top-1m.csv.zip'
URLHAUS_RECENT_TEMPLATE = 'https://urlhaus-api.abuse.ch/v2/files/exports/{auth_key}/recent.csv'

SPAMASSASSIN_BASE = 'https://spamassassin.apache.org/old/publiccorpus'
SPAMASSASSIN_CORPORA = [
    ('20030228_easy_ham.tar.bz2', 0),
    ('20030228_hard_ham.tar.bz2', 0),
    ('20030228_spam.tar.bz2', 1),
    ('20030228_spam_2.tar.bz2', 1),
]


def download_bytes(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'CyberGuardAI dataset fetcher/1.0',
            'Accept': '*/*',
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def decode_gzip(data: bytes) -> bytes:
    import gzip

    return gzip.decompress(data)


def normalize_url(url: str) -> str:
    url = (url or '').strip()
    if not url:
        return ''
    if url.startswith(('http://', 'https://')):
        return url
    return f'https://{url}/'


def fetch_phishtank(limit: int) -> list[str]:
    try:
        data = decode_gzip(download_bytes(PHISHTANK_CSV_GZ))
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"PhishTank download skipped: {exc}")
        return []

    urls = []
    reader = csv.DictReader(io.StringIO(data.decode('utf-8', errors='replace')))
    for row in reader:
        if str(row.get('verified', '')).lower() == 'yes' and str(row.get('online', '')).lower() == 'yes':
            url = normalize_url(row.get('url', ''))
            if url:
                urls.append(url)
        if len(urls) >= limit:
            break
    print(f"Fetched {len(urls)} verified online phishing URLs from PhishTank")
    return urls


def fetch_urlhaus(limit: int) -> list[str]:
    auth_key = os.getenv('URLHAUS_AUTH_KEY', '').strip()
    if not auth_key:
        print("URLhaus skipped: set URLHAUS_AUTH_KEY to use the authenticated URLhaus export.")
        return []

    try:
        data = download_bytes(URLHAUS_RECENT_TEMPLATE.format(auth_key=auth_key))
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"URLhaus download skipped: {exc}")
        return []

    urls = []
    text = data.decode('utf-8', errors='replace')
    reader = csv.reader(line for line in text.splitlines() if line and not line.startswith('#'))
    for row in reader:
        if len(row) < 3:
            continue
        url = normalize_url(row[2])
        if url:
            urls.append(url)
        if len(urls) >= limit:
            break
    print(f"Fetched {len(urls)} malware URLs from URLhaus")
    return urls


def fetch_tranco(limit: int) -> list[str]:
    try:
        data = download_bytes(TRANCO_TOP_1M_ZIP)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"Tranco download skipped: {exc}")
        return []

    domains = []
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        csv_name = next((name for name in archive.namelist() if name.endswith('.csv')), None)
        if not csv_name:
            return []
        with archive.open(csv_name) as fh:
            text = io.TextIOWrapper(fh, encoding='utf-8', errors='replace')
            reader = csv.reader(text)
            for row in reader:
                if len(row) < 2:
                    continue
                domain = row[1].strip().lower()
                if domain:
                    domains.append(normalize_url(domain))
                if len(domains) >= limit:
                    break
    print(f"Fetched {len(domains)} legitimate top-site domains from Tranco")
    return domains


def extract_message_text(raw_message: bytes) -> str:
    try:
        msg = BytesParser(policy=policy.default).parsebytes(raw_message)
    except Exception:
        return raw_message.decode('utf-8', errors='replace')[:20000]

    parts = []
    subject = msg.get('subject', '')
    if subject:
        parts.append(f"Subject: {subject}")

    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == 'text/plain':
                try:
                    parts.append(part.get_content())
                except Exception:
                    continue
    elif msg.get_content_type() == 'text/plain':
        try:
            parts.append(msg.get_content())
        except Exception:
            pass

    text = '\n'.join(part for part in parts if part)
    return text[:20000]


def fetch_spamassassin(max_per_label: int) -> list[tuple[str, int]]:
    rows = []
    counts = {0: 0, 1: 0}

    with tempfile.TemporaryDirectory() as tmpdir:
        for filename, label in SPAMASSASSIN_CORPORA:
            if counts[label] >= max_per_label:
                continue
            url = f'{SPAMASSASSIN_BASE}/{filename}'
            try:
                archive_bytes = download_bytes(url)
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                print(f"SpamAssassin corpus skipped ({filename}): {exc}")
                continue

            archive_path = os.path.join(tmpdir, filename)
            with open(archive_path, 'wb') as fh:
                fh.write(archive_bytes)

            with tarfile.open(archive_path, 'r:bz2') as archive:
                for member in archive.getmembers():
                    if counts[label] >= max_per_label:
                        break
                    if not member.isfile():
                        continue
                    extracted = archive.extractfile(member)
                    if not extracted:
                        continue
                    text = extract_message_text(extracted.read())
                    if len(text) < 20:
                        continue
                    rows.append((text, label))
                    counts[label] += 1

    print(f"Fetched {counts[0]} ham and {counts[1]} spam emails from SpamAssassin")
    return rows


def write_url_dataset(phishing_urls: list[str], legitimate_urls: list[str]) -> str:
    output_path = os.path.join(DATA_DIR, 'trusted_url_dataset.csv')
    seen = set()

    with open(output_path, 'w', newline='', encoding='utf-8') as fh:
        writer = csv.DictWriter(fh, fieldnames=['url', 'label', 'source'])
        writer.writeheader()

        for url in phishing_urls:
            if url in seen:
                continue
            seen.add(url)
            writer.writerow({'url': url, 'label': 1, 'source': 'phishtank_urlhaus'})

        for url in legitimate_urls:
            if url in seen:
                continue
            seen.add(url)
            writer.writerow({'url': url, 'label': 0, 'source': 'tranco'})

    print(f"Wrote {len(seen)} URLs to {output_path}")
    return output_path


def write_email_dataset(rows: list[tuple[str, int]]) -> str:
    output_path = os.path.join(DATA_DIR, 'trusted_email_dataset.csv')
    with open(output_path, 'w', newline='', encoding='utf-8') as fh:
        writer = csv.DictWriter(fh, fieldnames=['text', 'label', 'source'])
        writer.writeheader()
        for text, label in rows:
            writer.writerow({'text': text, 'label': label, 'source': 'spamassassin_public_corpus'})
    print(f"Wrote {len(rows)} emails to {output_path}")
    return output_path


def main():
    phishing_limit = int(os.getenv('TRUSTED_PHISHING_LIMIT', '5000'))
    legitimate_limit = int(os.getenv('TRUSTED_LEGITIMATE_LIMIT', '5000'))
    email_limit_per_label = int(os.getenv('TRUSTED_EMAIL_LIMIT_PER_LABEL', '2000'))

    phishing_urls = []
    phishing_urls.extend(fetch_phishtank(phishing_limit))
    if len(phishing_urls) < phishing_limit:
        phishing_urls.extend(fetch_urlhaus(phishing_limit - len(phishing_urls)))

    legitimate_urls = fetch_tranco(legitimate_limit)
    write_url_dataset(phishing_urls, legitimate_urls)

    email_rows = fetch_spamassassin(email_limit_per_label)
    write_email_dataset(email_rows)


if __name__ == '__main__':
    main()
