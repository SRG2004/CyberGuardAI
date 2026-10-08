"""
CyberGuard ML — XAI Trigger Extraction Tests
Tests the _extract_triggers function for typo-squatting, homoglyphs, and keyword detection.

Run: cd ml-service && python -m pytest tests/test_xai_triggers.py -v
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import _extract_triggers


class TestEmailTriggers:
    """Email trigger extraction tests"""

    def test_urgency_keywords(self):
        triggers = _extract_triggers("URGENT: Your account is locked. Verify now.", "email")
        trigger_texts = [t["text"] for t in triggers]
        assert "urgent" in trigger_texts
        assert "locked" in trigger_texts
        assert "verify" in trigger_texts

    def test_paypal_keyword(self):
        triggers = _extract_triggers("Your PayPal account is suspended", "email")
        trigger_texts = [t["text"] for t in triggers]
        assert "paypal" in trigger_texts

    def test_gift_card(self):
        triggers = _extract_triggers("Free gift card winner claim now", "email")
        trigger_texts = [t["text"] for t in triggers]
        assert "gift card" in trigger_texts
        assert "free" in trigger_texts
        assert "claim" in trigger_texts

    def test_clean_email_no_triggers(self):
        triggers = _extract_triggers("Hey, are we still on for lunch tomorrow?", "email")
        assert len(triggers) == 0

    def test_trigger_has_required_fields(self):
        triggers = _extract_triggers("URGENT verify your password", "email")
        for t in triggers:
            assert "text" in t
            assert "type" in t
            assert "severity" in t
            assert "reason" in t


class TestURLTriggers:
    """URL trigger extraction tests"""

    def test_ip_address(self):
        triggers = _extract_triggers("http://192.168.1.1/login", "url")
        types = [t["type"] for t in triggers]
        assert "IP Address Masking" in types

    def test_subdomain_nesting(self):
        triggers = _extract_triggers("http://login.paypal.verify.evil.com/page", "url")
        types = [t["type"] for t in triggers]
        assert "Subdomain Nesting" in types

    def test_brand_in_path(self):
        triggers = _extract_triggers("http://evil.com/paypal/login", "url")
        types = [t["type"] for t in triggers]
        assert "Brand Spoofing" in types

    def test_punycode_homoglyph(self):
        triggers = _extract_triggers("http://xn--80ak6aa92e.com/", "url")
        types = [t["type"] for t in triggers]
        assert "Homograph Attack" in types

    def test_typosquatting(self):
        triggers = _extract_triggers("http://paypa1.com/login", "url")
        types = [t["type"] for t in triggers]
        assert "Typo-squatting" in types

    def test_typosquatting_amazon(self):
        triggers = _extract_triggers("http://amaz0n.com/verify", "url")
        types = [t["type"] for t in triggers]
        assert "Typo-squatting" in types

    def test_safe_url_no_triggers(self):
        triggers = _extract_triggers("https://www.google.com", "url")
        assert len(triggers) == 0

    def test_multiple_triggers(self):
        """URL with multiple issues should return multiple triggers"""
        triggers = _extract_triggers("http://192.168.1.1/paypal/login", "url")
        types = [t["type"] for t in triggers]
        assert "IP Address Masking" in types
        assert "Brand Spoofing" in types


class TestEdgeCases:
    """Edge cases and robustness"""

    def test_empty_text(self):
        triggers = _extract_triggers("", "email")
        assert isinstance(triggers, list)

    def test_unknown_type(self):
        """Unknown analysis type should return empty list"""
        triggers = _extract_triggers("test text", "unknown_type")
        assert triggers == []

    def test_case_insensitive(self):
        triggers = _extract_triggers("URGENT PAYPAL VERIFY", "email")
        trigger_texts = [t["text"] for t in triggers]
        assert "urgent" in trigger_texts
        assert "paypal" in trigger_texts

    def test_unicode_handling(self):
        triggers = _extract_triggers("http://pаypal.com/login", "url")  # Cyrillic а
        assert isinstance(triggers, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
