import re
from typing import Tuple, List
from app.database.models import ContentVariant, ComplianceStatus

FORBIDDEN_PHRASES = [
    r"\bguaranteed to cure\b",
    r"\bfree money\b",
    r"\bget rich quick\b",
    r"\bamazon glitch\b",
    r"\bsecret amazon hack to get free\b",
    r"\bofficial partner of apple\b",
    r"\bofficial amazon representative\b"
]

FTC_DISCLOSURE_PATTERNS = [
    r"#ad\b",
    r"#affiliate\b",
    r"#sponsored\b",
    r"#commissionsearned\b",
    r"as an amazon associate\b",
    r"affiliate link\b"
]

class ComplianceEngine:
    """
    7-Stage automated compliance validation engine for FTC, Amazon Associates,
    copyright, and platform terms of service.
    """

    @classmethod
    def validate(cls, variant: ContentVariant) -> Tuple[ComplianceStatus, List[str]]:
        notes: List[str] = []
        is_blocked = False
        is_warn = False

        full_text = f"{variant.hook_text}\n{variant.body_script}\n{variant.cta_text}\n{variant.disclosure_text}\n{' '.join(variant.hashtags)}".lower()

        # Stage 1: FTC Disclosure Check
        has_ftc = any(re.search(pat, full_text) for pat in FTC_DISCLOSURE_PATTERNS)
        if not has_ftc:
            notes.append("BLOCKED: Missing conspicuous FTC affiliate disclosure (#ad, #affiliate, or disclaimer).")
            is_blocked = True
        else:
            notes.append("PASSED: Verified FTC affiliate disclosure.")

        # Stage 2: Amazon Associates Compliance
        if "as an amazon associate i earn from qualifying purchases" not in variant.disclosure_text.lower():
            notes.append("WARN: Full Amazon operating agreement clause recommended in disclosure text.")
            is_warn = True
        else:
            notes.append("PASSED: Amazon operating agreement disclosure clause verified.")

        # Stage 3: Misleading Claims Filter
        for pattern in FORBIDDEN_PHRASES:
            if re.search(pattern, full_text):
                notes.append(f"BLOCKED: Prohibited misleading or unauthorized claim detected matching '{pattern}'.")
                is_blocked = True

        # Stage 4: Trademark Safety
        if "exclusive official distributor" in full_text or "endorsed by amazon" in full_text:
            notes.append("BLOCKED: Unauthorized endorsement or trademark misrepresentation detected.")
            is_blocked = True

        # Stage 5: Platform Constraint Limits
        if len(full_text) > 2200:
            notes.append("WARN: Total caption length exceeds Instagram 2,200 character limit.")
            is_warn = True
        if len(variant.hook_text) > 100:
            notes.append("WARN: Hook exceeds 100 characters, may be truncated on YouTube Shorts.")
            is_warn = True

        # Stage 6: Price Freshness Warning
        if "₹" in full_text and "subject to change" not in full_text and "time of publication" not in full_text:
            notes.append("WARN: Static price mentioned without dynamic pricing disclaimer.")
            is_warn = True

        # Stage 7: Final Status Determination
        if is_blocked:
            status = ComplianceStatus.BLOCKED
        elif is_warn:
            status = ComplianceStatus.WARN
        else:
            status = ComplianceStatus.PASSED

        return status, notes
