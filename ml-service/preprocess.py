import re
import math
import string
from collections import Counter
from urllib.parse import urlparse, parse_qs
import nltk
try:
    from nltk.corpus import stopwords
    from nltk.stem import PorterStemmer
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)
from nltk.corpus import stopwords as sw
from nltk.stem import PorterStemmer

try:
    import tldextract
    HAS_TLDEXTRACT = True
except ImportError:
    HAS_TLDEXTRACT = False

try:
    from Levenshtein import distance as levenshtein_distance
    HAS_LEVENSHTEIN = True
except ImportError:
    HAS_LEVENSHTEIN = False

STOP_WORDS = set(sw.words('english'))
PS = PorterStemmer()

# ─── Constants for feature extraction ─────────────────────────────────
TRUSTED_BRANDS = [
    'google', 'facebook', 'apple', 'microsoft', 'amazon', 'netflix', 'paypal',
    'instagram', 'twitter', 'linkedin', 'github', 'dropbox', 'yahoo', 'outlook',
    'chase', 'wellsfargo', 'bankofamerica', 'citibank', 'spotify', 'zoom',
    'ebay', 'whatsapp', 'telegram', 'signal', 'adobe', 'salesforce', 'stripe',
    'square', 'venmo', 'coinbase', 'binance', 'kraken', 'reddit', 'tiktok',
]

HIGH_RISK_TLDS = {
    '.xyz': 0.9, '.top': 0.9, '.tk': 0.95, '.ml': 0.95, '.ga': 0.95, '.cf': 0.95,
    '.gq': 0.9, '.buzz': 0.8, '.work': 0.7, '.click': 0.85, '.icu': 0.8,
    '.zip': 0.9, '.mov': 0.8, '.cam': 0.8, '.quest': 0.7, '.site': 0.7,
    '.online': 0.65, '.space': 0.7, '.fun': 0.7, '.info': 0.5, '.biz': 0.5,
    '.club': 0.6, '.wang': 0.8, '.pw': 0.85, '.win': 0.8, '.bid': 0.75,
    '.loan': 0.8, '.download': 0.8, '.stream': 0.7, '.racing': 0.75,
}

LOW_RISK_TLDS = {'.com', '.org', '.net', '.edu', '.gov', '.mil', '.int', '.co.uk', '.ac.uk'}

URL_SHORTENERS = {
    'bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'goo.gl', 'ow.ly', 'buff.ly',
    'cutt.ly', 'rebrand.ly', 'short.link', 'tiny.cc', 'shorturl.at', 'rb.gy',
    'v.gd', 'clck.ru', 'lnkd.in', 'soo.gd', 'qr.ae', 's2r.co', 'bl.ink',
    'x.co', 'yourls.org', 'adf.ly', 'bc.vc', 'j.mp',
}

PHISHING_KEYWORDS = [
    'login', 'verify', 'secure', 'update', 'account', 'password', 'confirm',
    'bank', 'signin', 'sign-in', 'paypal', 'ebay', 'amazon', 'netflix',
    'support', 'validate', 'activate', 'renew', 'unlock', 'suspended',
    'billing', 'invoice', 'alert', 'notification', 'verification', 'authenticate',
    'credential', 'ssn', 'social-security', 'tax-refund', 'wire-transfer',
    'reset-password', 'unusual-activity', 'expire', 'deactivate', 'reactivate',
    'restore', 'recover', 'unauthorized', 'compromise', 'breach',
    'urgent', 'immediately', 'action-required', 'limited-time',
]

SUSPICIOUS_FILE_EXTENSIONS = {
    '.exe', '.php', '.cgi', '.asp', '.aspx', '.jsp', '.scr', '.bat',
    '.cmd', '.com', '.pif', '.vbs', '.js', '.wsf', '.hta',
}


def _shannon_entropy(s: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not s:
        return 0.0
    freq = Counter(s)
    probs = [f / len(s) for f in freq.values()]
    return -sum(p * math.log2(p) for p in probs if p > 0)


def _extract_domain_parts(url: str) -> dict:
    """Extract domain, subdomain, TLD, and registered domain."""
    if HAS_TLDEXTRACT:
        ext = tldextract.extract(url)
        return {
            'subdomain': ext.subdomain,
            'domain': ext.domain,
            'tld': ext.suffix,
            'registered_domain': ext.registered_domain,
            'fqdn': ext.fqdn,
        }
    else:
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname or ''
            parts = hostname.split('.')
            if len(parts) >= 3:
                return {
                    'subdomain': '.'.join(parts[:-2]),
                    'domain': parts[-2],
                    'tld': parts[-1],
                    'registered_domain': '.'.join(parts[-2:]),
                    'fqdn': hostname,
                }
            elif len(parts) == 2:
                return {
                    'subdomain': '',
                    'domain': parts[0],
                    'tld': parts[1],
                    'registered_domain': hostname,
                    'fqdn': hostname,
                }
            else:
                return {'subdomain': '', 'domain': hostname, 'tld': '', 'registered_domain': hostname, 'fqdn': hostname}
        except Exception:
            return {'subdomain': '', 'domain': '', 'tld': '', 'registered_domain': '', 'fqdn': ''}


def _brand_similarity_score(hostname: str) -> float:
    """Calculate minimum Levenshtein distance to any known brand."""
    if not HAS_LEVENSHTEIN or not hostname:
        # Fallback: simple substring check
        hostname_lower = hostname.lower()
        for brand in TRUSTED_BRANDS:
            if brand in hostname_lower:
                return 0.0
        return 1.0

    hostname_lower = hostname.lower().replace('.', '').replace('-', '')
    min_dist = float('inf')
    for brand in TRUSTED_BRANDS:
        # Check domain contains near-match to brand
        for i in range(max(1, len(hostname_lower) - len(brand) + 1)):
            chunk = hostname_lower[i:i+len(brand)]
            if len(chunk) >= len(brand) - 2:
                dist = levenshtein_distance(chunk, brand)
                min_dist = min(min_dist, dist)

    # Normalize: 0 = exact match, 1 = very different
    if min_dist == float('inf'):
        return 1.0
    max_brand_len = max(len(b) for b in TRUSTED_BRANDS)
    return min(min_dist / max(max_brand_len, 1), 1.0)


def _count_consecutive_digits(s: str) -> int:
    """Find the longest run of consecutive digits."""
    max_run = 0
    current = 0
    for c in s:
        if c.isdigit():
            current += 1
            max_run = max(max_run, current)
        else:
            current = 0
    return max_run


def _consonant_vowel_ratio(s: str) -> float:
    """Calculate ratio of consonants to vowels in a string."""
    vowels = set('aeiouAEIOU')
    consonants = set(string.ascii_letters) - vowels
    v_count = sum(1 for c in s if c in vowels)
    c_count = sum(1 for c in s if c in consonants)
    return c_count / max(v_count, 1)


# ─── Main URL Feature Extractor (35+ features) ───────────────────────
URL_FEATURES = [
    # Original 12
    'url_length', 'has_at', 'has_double_dash', 'https', 'has_ip_address',
    'subdomain_count', 'special_char_count', 'digit_ratio', 'domain_entropy',
    'phishing_keywords', 'shortener', 'favicon',
    # New 23+ features
    'path_length', 'path_depth', 'query_param_count', 'query_length',
    'fragment_present', 'tld_risk_score', 'domain_length',
    'has_punycode', 'brand_similarity', 'has_hex_chars', 'has_base64_pattern',
    'consecutive_digits', 'consonant_ratio', 'dot_count', 'dash_count',
    'path_has_suspicious_ext', 'port_present', 'token_count_domain',
    'digit_count_path', 'brand_in_subdomain', 'suspicious_tld_combo',
    'url_entropy', 'domain_has_digits', 'path_entropy',
    'protocol_relative', 'double_slash_in_path', 'at_in_netloc',
]


def extract_url_features(url: str) -> dict:
    """Extract 35+ features from a URL for ML classification."""
    url_lower = url.lower()
    features = {}

    # Parse URL
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or '').lower()
        path = parsed.path or ''
        query = parsed.query or ''
        fragment = parsed.fragment or ''
    except Exception:
        parsed = None
        hostname = ''
        path = ''
        query = ''
        fragment = ''

    # Extract domain parts
    parts = _extract_domain_parts(url)
    subdomain = parts['subdomain']
    registered_domain = parts['registered_domain']
    tld = parts['tld']

    # ─── Original Features (preserved) ────────────────────────
    features['url_length'] = len(url)
    features['has_at'] = 1 if '@' in url else 0
    features['has_double_dash'] = 1 if '--' in url else 0
    features['https'] = 1 if url.startswith('https://') else 0

    # IP address in domain
    ip_pattern = r'https?://(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
    features['has_ip_address'] = 1 if re.search(ip_pattern, url) else 0

    # Subdomain count
    subdomains = hostname.split('.') if hostname else []
    features['subdomain_count'] = max(0, len(subdomains) - 2)

    # Special characters
    features['special_char_count'] = len(re.findall(r'[@\-_?=&%#!~]', url))

    # Digit ratio in domain
    domain_chars = len(hostname) if hostname else 1
    digit_count = len(re.findall(r'\d', hostname))
    features['digit_ratio'] = digit_count / max(domain_chars, 1)

    # Domain entropy
    features['domain_entropy'] = _shannon_entropy(hostname)

    # Phishing keywords count
    features['phishing_keywords'] = sum(1 for kw in PHISHING_KEYWORDS if kw in url_lower)

    # URL shortener
    features['shortener'] = 1 if any(s in url_lower for s in URL_SHORTENERS) else 0

    # Favicon (legacy)
    features['favicon'] = 1 if 'favicon' in url_lower else 0

    # ─── New Features ─────────────────────────────────────────

    # Path analysis
    features['path_length'] = len(path)
    path_segments = [s for s in path.split('/') if s]
    features['path_depth'] = len(path_segments)

    # Query string analysis
    try:
        params = parse_qs(query)
        features['query_param_count'] = len(params)
    except Exception:
        features['query_param_count'] = 0
    features['query_length'] = len(query)

    # Fragment
    features['fragment_present'] = 1 if fragment else 0

    # TLD risk score
    tld_dot = f'.{tld}' if tld and not tld.startswith('.') else (tld or '')
    features['tld_risk_score'] = HIGH_RISK_TLDS.get(tld_dot, 0.1 if tld_dot in LOW_RISK_TLDS else 0.3)

    # Domain length
    features['domain_length'] = len(parts['domain'])

    # Punycode / IDN homograph attack
    features['has_punycode'] = 1 if 'xn--' in hostname else 0

    # Brand similarity (how close domain is to a known brand — typosquatting detection)
    features['brand_similarity'] = _brand_similarity_score(hostname)

    # Hex-encoded characters (URL obfuscation)
    hex_matches = re.findall(r'%[0-9a-fA-F]{2}', url)
    features['has_hex_chars'] = min(len(hex_matches), 10)  # cap at 10

    # Base64-like patterns in URL
    base64_pattern = re.findall(r'[A-Za-z0-9+/]{20,}={0,2}', url)
    features['has_base64_pattern'] = 1 if base64_pattern else 0

    # Consecutive digits
    features['consecutive_digits'] = _count_consecutive_digits(hostname)

    # Consonant/vowel ratio (DGA detection)
    features['consonant_ratio'] = _consonant_vowel_ratio(parts['domain'])

    # Dot and dash counts in hostname
    features['dot_count'] = hostname.count('.')
    features['dash_count'] = hostname.count('-')

    # Suspicious file extension in path
    path_lower = path.lower()
    features['path_has_suspicious_ext'] = 1 if any(path_lower.endswith(ext) for ext in SUSPICIOUS_FILE_EXTENSIONS) else 0

    # Non-standard port
    try:
        port = parsed.port if parsed else None
        features['port_present'] = 1 if port and port not in (80, 443, None) else 0
    except Exception:
        features['port_present'] = 0

    # Token count in domain (split by - and .)
    tokens = re.split(r'[-.]', hostname)
    features['token_count_domain'] = len([t for t in tokens if t])

    # Digits in path
    features['digit_count_path'] = len(re.findall(r'\d', path))

    # Brand name in subdomain but not in registered domain (impersonation)
    features['brand_in_subdomain'] = 0
    if subdomain:
        for brand in TRUSTED_BRANDS:
            if brand in subdomain.lower() and brand not in registered_domain.lower():
                features['brand_in_subdomain'] = 1
                break

    # Suspicious TLD + keyword combo
    features['suspicious_tld_combo'] = 0
    if features['tld_risk_score'] > 0.6 and features['phishing_keywords'] > 0:
        features['suspicious_tld_combo'] = 1

    # Full URL entropy
    features['url_entropy'] = _shannon_entropy(url)

    # Domain has digits (legitimate domains rarely have digits)
    features['domain_has_digits'] = 1 if re.search(r'\d', parts['domain']) else 0

    # Path entropy
    features['path_entropy'] = _shannon_entropy(path)

    # Protocol-relative URL
    features['protocol_relative'] = 1 if url.startswith('//') else 0

    # Double slash in path (after protocol)
    path_part = url.split('://', 1)[1] if '://' in url else url
    features['double_slash_in_path'] = 1 if '//' in path_part else 0

    # @ sign in netloc (credential-stuffing URLs)
    try:
        netloc = parsed.netloc if parsed else ''
        features['at_in_netloc'] = 1 if '@' in netloc else 0
    except Exception:
        features['at_in_netloc'] = 0

    return features


# ─── Email preprocessing (preserved + enhanced) ──────────────────────
def clean_email_text(text: str) -> str:
    """Clean email text for ML processing."""
    # Strip HTML
    text = re.sub(r'<[^>]+>', ' ', text)
    # Lowercase
    text = text.lower()
    # Remove URLs
    text = re.sub(r'https?://\S+', ' ', text)
    # Remove emails
    text = re.sub(r'\S+@\S+', ' ', text)
    # Remove special chars
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    # Remove stopwords and stem
    words = text.split()
    words = [PS.stem(w) for w in words if w not in STOP_WORDS and len(w) > 2]
    return ' '.join(words)


def extract_email_features(subject: str, body: str) -> dict:
    """Extract features from email content for ML scoring."""
    # Urgency keywords
    urgency_phrases = [
        'immediate action', 'act now', 'verify your account', 'suspended',
        'unusual activity', 'confirm your identity', 'update your payment',
        'your account has been', 'limited access', 'temporary hold',
        'final notice', 'last chance', 'expire', 'unauthorized',
        'click here', 'do not reply', 'do not ignore', 'important',
        'urgent', 'action required', 'security alert', 'verify now',
        'password reset', 'account locked', 'verify immediately',
        'respond within', 'hours left', 'final warning',
    ]
    combined_text = f"{subject} {body}".lower()
    urgency_score = sum(1 for phrase in urgency_phrases if phrase in combined_text)
    urgency_norm = min(urgency_score / 5.0, 1.0)

    # Link counts
    html_links = len(re.findall(r'<a[^>]+href=["\']([^"\']+)', body))
    text_links = len(re.findall(r'https?://[^\s<>]+', body))
    link_ratio = html_links / max(text_links, 1) if text_links > 0 else html_links

    # Has unsubscribe
    has_unsubscribe = 1 if 'unsubscribe' in combined_text else 0

    # Email-specific features
    # Ratio of HTML to text
    plain_text_len = len(re.sub(r'<[^>]+>', '', body))
    total_len = len(body)
    html_ratio = 1 - (plain_text_len / max(total_len, 1))

    # Subject analysis
    subject_upper_ratio = sum(1 for c in subject if c.isupper()) / max(len(subject), 1)
    subject_exclamation = subject.count('!')
    subject_length = len(subject)

    return {
        'urgency_score': urgency_norm,
        'html_link_count': html_links,
        'text_link_count': text_links,
        'link_ratio': min(link_ratio, 5.0),
        'has_unsubscribe': has_unsubscribe,
        'html_ratio': html_ratio,
        'subject_upper_ratio': subject_upper_ratio,
        'subject_exclamation': subject_exclamation,
        'subject_length': subject_length,
    }
