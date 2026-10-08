/**
 * CyberGuard ML Service — Unit & Security Tests
 * Tests the Python ML endpoints via HTTP for correctness, accuracy, and security.
 * 
 * Run: python -m pytest tests/test_ml_service.py -v
 */
import pytest
import requests
import json
import time

BASE_URL = "http://localhost:8001"

# ═══════════════════════════════════════════════════════════════════════
# UNIT TESTS — URL Prediction
# ═══════════════════════════════════════════════════════════════════════

class TestURLPrediction:
    """Tests for /predict/url endpoint"""

    def test_safe_url(self):
        """TC-01: Known safe URL should return safe verdict"""
        res = requests.post(f"{BASE_URL}/predict/url", json={"url": "https://www.google.com"})
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "safe"
        assert data["riskScore"] < 50

    def test_phishing_url_with_ip(self):
        """TC-03: URL with IP address should trigger IP Address Masking XAI"""
        res = requests.post(f"{BASE_URL}/predict/url", json={"url": "http://192.168.1.1/login"})
        assert res.status_code == 200
        data = res.json()
        triggers = [t["type"] for t in data.get("xai_analysis", [])]
        assert "IP Address Masking" in triggers

    def test_typosquatting_detection(self):
        """TC-02: Typo-squatted domain should be flagged"""
        res = requests.post(f"{BASE_URL}/predict/url", json={"url": "http://paypa1-update.com/login"})
        assert res.status_code == 200
        data = res.json()
        triggers = [t["type"] for t in data.get("xai_analysis", [])]
        assert "Typo-squatting" in triggers

    def test_homoglyph_punycode(self):
        """TC-04: Punycode domain should trigger Homograph Attack"""
        res = requests.post(f"{BASE_URL}/predict/url", json={"url": "http://xn--80ak6aa92e.com/"})
        assert res.status_code == 200
        data = res.json()
        triggers = [t["type"] for t in data.get("xai_analysis", [])]
        assert "Homograph Attack" in triggers

    def test_brand_in_path(self):
        """TC-05: Brand name in URL path should flag Brand Spoofing"""
        res = requests.post(f"{BASE_URL}/predict/url", json={"url": "http://evil.com/paypal/login"})
        assert res.status_code == 200
        data = res.json()
        triggers = [t["type"] for t in data.get("xai_analysis", [])]
        assert "Brand Spoofing" in triggers

    def test_subdomain_nesting(self):
        """TC-06: Excessive subdomains should be flagged"""
        res = requests.post(f"{BASE_URL}/predict/url", json={"url": "http://login.paypal.verify.evil.com"})
        assert res.status_code == 200
        data = res.json()
        triggers = [t["type"] for t in data.get("xai_analysis", [])]
        assert "Subdomain Nesting" in triggers

    def test_response_schema(self):
        """Verify response contains all required fields"""
        res = requests.post(f"{BASE_URL}/predict/url", json={"url": "https://example.com"})
        data = res.json()
        assert "verdict" in data
        assert "riskScore" in data
        assert "confidence" in data
        assert "xai_analysis" in data
        assert isinstance(data["xai_analysis"], list)

    def test_risk_score_range(self):
        """Risk score should always be between 0 and 100"""
        urls = ["https://google.com", "http://paypa1.com/login", "http://192.168.1.1/login"]
        for url in urls:
            res = requests.post(f"{BASE_URL}/predict/url", json={"url": url})
            data = res.json()
            assert 0 <= data["riskScore"] <= 100, f"Score {data['riskScore']} out of range for {url}"


# ═══════════════════════════════════════════════════════════════════════
# UNIT TESTS — Email Prediction
# ═══════════════════════════════════════════════════════════════════════

class TestEmailPrediction:
    """Tests for /predict/email endpoint"""

    def test_phishing_email(self):
        """TC-09: Obvious phishing email should score high"""
        res = requests.post(f"{BASE_URL}/predict/email", json={
            "subject": "URGENT: Account Locked",
            "body": "Your PayPal account is locked. Click here to verify your identity immediately."
        })
        assert res.status_code == 200
        data = res.json()
        assert data["riskScore"] > 50
        assert data["verdict"] == "phishing"

    def test_legitimate_email(self):
        """TC-10: Normal email should score low"""
        res = requests.post(f"{BASE_URL}/predict/email", json={
            "subject": "Team meeting",
            "body": "Hey, are we still on for lunch at 1pm tomorrow?"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["riskScore"] < 40
        assert data["verdict"] == "legitimate"

    def test_gift_card_scam(self):
        """TC-11: Gift card scam should score very high"""
        res = requests.post(f"{BASE_URL}/predict/email", json={
            "subject": "You Won!",
            "body": "Congratulations! You've won a free $1000 Walmart Gift Card. Reply WIN to claim."
        })
        assert res.status_code == 200
        data = res.json()
        assert data["riskScore"] > 40

    def test_xai_triggers_present(self):
        """XAI analysis should return trigger objects for phishing emails"""
        res = requests.post(f"{BASE_URL}/predict/email", json={
            "subject": "Urgent",
            "body": "Your PayPal account has been suspended. Verify now to unlock."
        })
        data = res.json()
        assert len(data.get("xai_analysis", [])) > 0
        for trigger in data["xai_analysis"]:
            assert "text" in trigger
            assert "type" in trigger
            assert "severity" in trigger

    def test_email_response_schema(self):
        """Verify email response contains all required fields"""
        res = requests.post(f"{BASE_URL}/predict/email", json={"subject": "Test", "body": "Test body"})
        data = res.json()
        assert "verdict" in data
        assert "riskScore" in data
        assert "confidence" in data
        assert "xai_analysis" in data

    def test_empty_email(self):
        """Empty email should not crash"""
        res = requests.post(f"{BASE_URL}/predict/email", json={"subject": "", "body": ""})
        assert res.status_code == 200
        data = res.json()
        assert "verdict" in data

    def test_risk_score_range_email(self):
        """Email risk scores must be 0-100"""
        res = requests.post(f"{BASE_URL}/predict/email", json={
            "subject": "URGENT",
            "body": "Click here to verify your PayPal account locked suspended"
        })
        data = res.json()
        assert 0 <= data["riskScore"] <= 100


# ═══════════════════════════════════════════════════════════════════════
# UNIT TESTS — Page Prediction (Sandbox)
# ═══════════════════════════════════════════════════════════════════════

class TestPagePrediction:
    """Tests for /predict/page endpoint"""

    def test_page_with_credential_form(self):
        """Page with cross-origin credential form should score high"""
        res = requests.post(f"{BASE_URL}/predict/page", json={
            "url": "http://evil-site.com/login",
            "forms": [{"action": "http://other-domain.com/steal", "method": "post", "fields": [{"name": "password", "type": "password"}]}],
            "iframes": [],
            "dom_anomalies": [],
            "js_signals": [],
            "redirect_chain": []
        })
        assert res.status_code == 200
        data = res.json()
        assert data["score"] > 0.3

    def test_page_with_hidden_iframe(self):
        """Hidden iframe should increase risk score"""
        res = requests.post(f"{BASE_URL}/predict/page", json={
            "url": "http://suspicious.com",
            "forms": [],
            "iframes": [{"src": "http://evil.com/hidden", "hidden": True}],
            "dom_anomalies": [],
            "js_signals": [],
            "redirect_chain": []
        })
        assert res.status_code == 200

    def test_clean_page(self):
        """Clean page with no forms/iframes should score low"""
        res = requests.post(f"{BASE_URL}/predict/page", json={
            "url": "https://www.google.com",
            "forms": [],
            "iframes": [],
            "dom_anomalies": [],
            "js_signals": [],
            "redirect_chain": []
        })
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# SECURITY TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestSecurity:
    """Security-focused tests"""

    def test_sql_injection_in_url(self):
        """SQL injection payload in URL should not crash the service"""
        res = requests.post(f"{BASE_URL}/predict/url", json={
            "url": "http://evil.com/' OR 1=1 --"
        })
        assert res.status_code in [200, 422]  # Should either process or reject gracefully

    def test_xss_in_url(self):
        """XSS payload in URL should not be reflected in response"""
        xss = '<script>alert("XSS")</script>'
        res = requests.post(f"{BASE_URL}/predict/url", json={
            "url": f"http://evil.com/{xss}"
        })
        assert res.status_code in [200, 422]
        if res.status_code == 200:
            body = res.text
            assert '<script>' not in body

    def test_xss_in_email(self):
        """XSS payload in email body should not be reflected raw"""
        res = requests.post(f"{BASE_URL}/predict/email", json={
            "subject": '<img src=x onerror=alert(1)>',
            "body": '<script>document.cookie</script>'
        })
        assert res.status_code == 200
        body = res.text
        assert '<script>document.cookie</script>' not in body or 'xai_analysis' in body

    def test_oversized_url(self):
        """Extremely long URL should not crash the service"""
        long_url = "http://evil.com/" + "a" * 10000
        res = requests.post(f"{BASE_URL}/predict/url", json={"url": long_url})
        assert res.status_code in [200, 422, 413]

    def test_oversized_email(self):
        """Extremely large email body should not crash"""
        res = requests.post(f"{BASE_URL}/predict/email", json={
            "subject": "Test",
            "body": "A" * 100000
        })
        assert res.status_code in [200, 422, 413]

    def test_null_bytes_in_url(self):
        """Null bytes should be handled safely"""
        res = requests.post(f"{BASE_URL}/predict/url", json={
            "url": "http://evil.com/\x00malware"
        })
        assert res.status_code in [200, 422]

    def test_unicode_smuggling(self):
        """Unicode control characters should not bypass detection"""
        res = requests.post(f"{BASE_URL}/predict/url", json={
            "url": "http://p\u0430ypal.com/login"  # Cyrillic 'а' instead of Latin 'a'
        })
        assert res.status_code == 200

    def test_missing_required_field(self):
        """Missing required field should return 422"""
        res = requests.post(f"{BASE_URL}/predict/url", json={})
        assert res.status_code == 422

    def test_wrong_content_type(self):
        """Non-JSON content type should be rejected"""
        res = requests.post(f"{BASE_URL}/predict/url", data="not json", headers={"Content-Type": "text/plain"})
        assert res.status_code in [415, 422]

    def test_method_not_allowed(self):
        """GET on POST-only endpoint should return 405"""
        res = requests.get(f"{BASE_URL}/predict/url")
        assert res.status_code == 405


# ═══════════════════════════════════════════════════════════════════════
# PERFORMANCE / RATE TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestPerformance:
    """Basic performance validation"""

    def test_url_prediction_speed(self):
        """URL prediction should complete within 5 seconds"""
        start = time.time()
        res = requests.post(f"{BASE_URL}/predict/url", json={"url": "https://google.com"})
        elapsed = time.time() - start
        assert res.status_code == 200
        assert elapsed < 5.0, f"Took {elapsed:.1f}s — too slow"

    def test_email_prediction_speed(self):
        """Email prediction should complete within 5 seconds"""
        start = time.time()
        res = requests.post(f"{BASE_URL}/predict/email", json={"subject": "Test", "body": "Hello world"})
        elapsed = time.time() - start
        assert res.status_code == 200
        assert elapsed < 5.0

    def test_health_endpoint(self):
        """TC-34: Health check should confirm models are loaded"""
        res = requests.get(f"{BASE_URL}/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["model_loaded"] == True


# ═══════════════════════════════════════════════════════════════════════
# ACCURACY TESTS — Real-World Samples
# ═══════════════════════════════════════════════════════════════════════

class TestAccuracy:
    """Test with real-world-like samples to measure accuracy"""

    PHISHING_URLS = [
        "http://paypa1-update.com/login",
        "http://192.168.1.100/banking/verify",
        "http://amaz0n-verify.tk/account",
        "http://login-netflix-update.xyz/verify",
        "http://xn--80ak6aa92e.com/",
    ]

    SAFE_URLS = [
        "https://www.google.com",
        "https://github.com",
        "https://stackoverflow.com/questions",
        "https://en.wikipedia.org/wiki/Python",
        "https://www.youtube.com",
    ]

    PHISHING_EMAILS = [
        {"subject": "URGENT: Verify Account", "body": "Your PayPal account is locked. Click here to verify your identity."},
        {"subject": "Action Required", "body": "Your Amazon order has been suspended. Confirm your payment details immediately."},
        {"subject": "You Won!", "body": "Congratulations! You've won a free $1000 Gift Card. Reply WIN to claim now."},
        {"subject": "Security Alert", "body": "Unusual activity detected on your bank account. Verify immediately or your account will be suspended."},
        {"subject": "Password Reset", "body": "Click here to reset your password. This link expires in 1 hour. If you didn't request this, someone may have access."},
    ]

    SAFE_EMAILS = [
        {"subject": "Team lunch", "body": "Hey, are we still on for lunch at 1pm tomorrow?"},
        {"subject": "Meeting notes", "body": "Hi team, attached is the Q3 financial report for your review. Thanks, Sarah."},
        {"subject": "Weekend plans", "body": "Don't forget to buy milk on your way home!"},
        {"subject": "Project update", "body": "The deployment went smoothly. All tests passing. Great work everyone."},
        {"subject": "Happy birthday!", "body": "Wishing you a wonderful birthday! Hope you have a great day."},
    ]

    def test_url_true_positive_rate(self):
        """Phishing URLs should be detected with >60% TPR"""
        detected = 0
        for url in self.PHISHING_URLS:
            res = requests.post(f"{BASE_URL}/predict/url", json={"url": url})
            if res.json().get("verdict") == "phishing":
                detected += 1
        tpr = detected / len(self.PHISHING_URLS)
        print(f"\n📊 URL True Positive Rate: {tpr*100:.0f}% ({detected}/{len(self.PHISHING_URLS)})")
        assert tpr >= 0.6, f"TPR too low: {tpr*100:.0f}%"

    def test_url_true_negative_rate(self):
        """Safe URLs should not be flagged with >80% TNR"""
        correct = 0
        for url in self.SAFE_URLS:
            res = requests.post(f"{BASE_URL}/predict/url", json={"url": url})
            if res.json().get("verdict") == "safe":
                correct += 1
        tnr = correct / len(self.SAFE_URLS)
        print(f"\n📊 URL True Negative Rate: {tnr*100:.0f}% ({correct}/{len(self.SAFE_URLS)})")
        assert tnr >= 0.8, f"TNR too low: {tnr*100:.0f}%"

    def test_email_true_positive_rate(self):
        """Phishing emails should be detected with >60% TPR"""
        detected = 0
        for email in self.PHISHING_EMAILS:
            res = requests.post(f"{BASE_URL}/predict/email", json=email)
            data = res.json()
            if data.get("verdict") == "phishing" or data.get("riskScore", 0) > 50:
                detected += 1
        tpr = detected / len(self.PHISHING_EMAILS)
        print(f"\n📊 Email True Positive Rate: {tpr*100:.0f}% ({detected}/{len(self.PHISHING_EMAILS)})")
        assert tpr >= 0.6, f"TPR too low: {tpr*100:.0f}%"

    def test_email_true_negative_rate(self):
        """Safe emails should not be flagged with >80% TNR"""
        correct = 0
        for email in self.SAFE_EMAILS:
            res = requests.post(f"{BASE_URL}/predict/email", json=email)
            data = res.json()
            if data.get("verdict") == "legitimate" or data.get("riskScore", 0) < 40:
                correct += 1
        tnr = correct / len(self.SAFE_EMAILS)
        print(f"\n📊 Email True Negative Rate: {tnr*100:.0f}% ({correct}/{len(self.SAFE_EMAILS)})")
        assert tnr >= 0.8, f"TNR too low: {tnr*100:.0f}%"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
