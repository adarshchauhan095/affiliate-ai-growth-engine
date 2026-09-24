import re
from typing import Optional, Tuple
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

ASIN_REGEX = re.compile(r"(?:/dp/|/gp/product/|/exec/obidos/ASIN/|/o/ASIN/|/product/)([A-Z0-9]{10})(?:[/?]|$)")

def extract_asin(url_or_text: str) -> Optional[str]:
    """Extract 10-character Amazon ASIN from URL or raw string."""
    text = url_or_text.strip()
    # Check if raw ASIN
    if re.match(r"^[A-Z0-9]{10}$", text):
        return text
    # Extract from URL
    match = ASIN_REGEX.search(text)
    if match:
        return match.group(1)
    return None

def build_affiliate_url(asin: str, tag: str = "mybudgetdeal9-21", marketplace: str = "IN") -> Tuple[str, str]:
    """
    Returns (affiliate_url, canonical_url).
    Follows Amazon operating agreement requirements: clean canonicalization with active tag.
    """
    domain = "amazon.in" if marketplace.upper() == "IN" else "amazon.com"
    canonical_url = f"https://www.{domain}/dp/{asin}"
    affiliate_url = f"{canonical_url}?tag={tag}"
    return affiliate_url, canonical_url
