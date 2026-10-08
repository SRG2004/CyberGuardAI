"""
CyberGuard ML Preprocess — Unit Tests
Tests the Python feature extraction functions in isolation.

Run: cd ml-service && python -m pytest tests/test_preprocess.py -v
"""
import pytest
import sys
import os

# Add ml-service to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from preprocess import extract_url_features, extract_email_features, clean_email_text, _shannon_entropy, _brand_similarity_score


class TestURLFeatures:
    """Unit tests for URL feature extraction"""

    def test_basic_url(self):
        features = extract_url_features("https://www.google.com")
        assert features['https'] == 1
        assert features['has_ip_address'] == 0
        assert features['shortener'] == 0

    def test_ip_address_detection(self):
        features = extract_url_features("http://192.168.1.1/login")
        assert features['has_ip_address'] == 1

    def test_at_sign_detection(self):
        features = extract_url_features("http://user@evil.com")
        assert features['has_at'] == 1
        assert features['at_in_netloc'] == 1

    def test_high_risk_tld(self):
        features = extract_url_features("http://evil.xyz/login")
        assert features['tld_risk_score'] >= 0.8

    def test_low_risk_tld(self):
        features = extract_url_features("https://google.com")
        assert features['tld_risk_score'] <= 0.2

    def test_shortener_detection(self):
        features = extract_url_features("https://bit.ly/abc123")
        assert features['shortener'] == 1

    def test_phishing_keywords(self):
        features = extract_url_features("http://evil.com/verify-account-login-password")
        assert features['phishing_keywords'] >= 3

    def test_punycode_detection(self):
        features = extract_url_features("http://xn--80ak6aa92e.com/")
        assert features['has_punycode'] == 1

    def test_brand_in_subdomain(self):
        features = extract_url_features("http://paypal.evil-domain.com/login")
        assert features['brand_in_subdomain'] == 1

    def test_suspicious_tld_combo(self):
        features = extract_url_features("http://verify-login.xyz/account")
        assert features['suspicious_tld_combo'] == 1

    def test_domain_has_digits(self):
        features = extract_url_features("http://evil123.com")
        assert features['domain_has_digits'] == 1

    def test_suspicious_extension(self):
        features = extract_url_features("http://evil.com/download.exe")
        assert features['path_has_suspicious_ext'] == 1

    def test_feature_count(self):
        """All 35+ features should be present"""
        features = extract_url_features("https://example.com")
        assert len(features) >= 35

    def test_no_nan_values(self):
        """No feature should be NaN"""
        import math
        features = extract_url_features("http://evil.com/test?a=1&b=2")
        for key, val in features.items():
            assert not math.isnan(val), f"Feature {key} is NaN"

    def test_url_length(self):
        url = "https://example.com/" + "a" * 100
        features = extract_url_features(url)
        assert features['url_length'] == len(url)


class TestEmailFeatures:
    """Unit tests for email feature extraction"""

    def test_urgency_detection(self):
        feats = extract_email_features("URGENT: Verify Account", "immediate action required")
        assert feats['urgency_score'] > 0.3

    def test_no_urgency(self):
        feats = extract_email_features("Team lunch", "Hey, want to grab lunch?")
        assert feats['urgency_score'] < 0.3

    def test_link_count(self):
        feats = extract_email_features("", "Visit https://evil.com and https://bad.com")
        assert feats['text_link_count'] == 2

    def test_unsubscribe_detection(self):
        feats = extract_email_features("", "Click here. Unsubscribe from this list.")
        assert feats['has_unsubscribe'] == 1

    def test_subject_analysis(self):
        feats = extract_email_features("URGENT!!!", "body text")
        assert feats['subject_exclamation'] == 3
        assert feats['subject_upper_ratio'] > 0.5


class TestCleanEmailText:
    """Tests for email text preprocessing"""

    def test_html_removal(self):
        result = clean_email_text("<b>Hello</b> <a href='http://evil.com'>click</a>")
        assert '<' not in result
        assert '>' not in result

    def test_url_removal(self):
        result = clean_email_text("Visit https://evil.com for details")
        assert 'evil.com' not in result

    def test_stopword_removal(self):
        result = clean_email_text("this is a test of the system")
        assert 'this' not in result.split()
        assert 'is' not in result.split()

    def test_stemming(self):
        result = clean_email_text("running quickly towards verification")
        assert 'running' not in result  # Should be stemmed


class TestShannonEntropy:
    """Tests for entropy calculation"""

    def test_empty_string(self):
        assert _shannon_entropy("") == 0.0

    def test_single_char(self):
        assert _shannon_entropy("aaaa") == 0.0

    def test_high_entropy(self):
        entropy = _shannon_entropy("abcdefghij1234567890")
        assert entropy > 3.0  # High entropy string

    def test_low_entropy(self):
        entropy = _shannon_entropy("aaabbb")
        assert entropy < 2.0


class TestBrandSimilarity:
    """Tests for brand similarity / typosquatting scoring"""

    def test_exact_match(self):
        score = _brand_similarity_score("paypal.com")
        assert score == 0.0

    def test_close_match(self):
        score = _brand_similarity_score("paypa1.com")
        assert score < 0.3  # Very close to a brand

    def test_no_match(self):
        score = _brand_similarity_score("xyzabc123.com")
        assert score > 0.5


# ═══════════════════════════════════════════════════════════════════════
# SECURITY TESTS — Input Fuzzing
# ═══════════════════════════════════════════════════════════════════════

class TestPreprocessSecurity:
    """Security edge cases for feature extraction"""

    def test_null_bytes(self):
        """Should handle null bytes without crash"""
        features = extract_url_features("http://evil.com/\x00test")
        assert isinstance(features, dict)

    def test_unicode_url(self):
        """Unicode URLs should not crash"""
        features = extract_url_features("http://München.de/path")
        assert isinstance(features, dict)

    def test_extremely_long_url(self):
        """Long URL should not crash or hang"""
        features = extract_url_features("http://evil.com/" + "a" * 50000)
        assert features['url_length'] > 50000

    def test_empty_url(self):
        """Empty URL should not crash"""
        features = extract_url_features("")
        assert isinstance(features, dict)

    def test_protocol_only(self):
        """Protocol-only URL should not crash"""
        features = extract_url_features("http://")
        assert isinstance(features, dict)

    def test_email_with_html_injection(self):
        """HTML injection in email should be stripped"""
        result = clean_email_text('<script>alert(1)</script><b>urgent</b>')
        assert '<script>' not in result
        assert 'alert' not in result  # scripts should be removed as HTML

    def test_email_extreme_length(self):
        """Very long email should not crash"""
        feats = extract_email_features("Test", "word " * 100000)
        assert isinstance(feats, dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
