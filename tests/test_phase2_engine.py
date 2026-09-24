import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.discovery.seed_catalog import SeedCatalogProvider
from app.discovery.url_normalizer import extract_asin, build_affiliate_url
from app.intelligence.trend_engine import TrendEngine
from app.intelligence.scoring_engine import ProductScoringEngine
from app.strategy.content_strategy import ContentStrategyEngine
from app.compliance.compliance_engine import ComplianceEngine
from app.media.video_engine import VideoEngine
from app.database.models import ComplianceStatus

def test_url_normalizer():
    url = "https://www.amazon.in/Portronics-Konnect-L-Charging-Cable/dp/B0BT9CXXXX/ref=sr_1_1"
    asin = extract_asin(url)
    assert asin == "B0BT9CXXXX"

    aff_url, can_url = build_affiliate_url(asin, tag="mybudgetdeal9-21")
    assert "tag=mybudgetdeal9-21" in aff_url
    assert "amazon.in/dp/B0BT9CXXXX" in can_url

def test_seed_catalog_and_discovery():
    provider = SeedCatalogProvider()
    products = provider.get_trending_products(limit=5)
    assert len(products) > 0
    p = products[0]
    assert p.asin
    assert "mybudgetdeal9-21" in p.affiliate_url

def test_trend_and_scoring_engine():
    provider = SeedCatalogProvider()
    product = provider.get_trending_products(limit=1)[0]

    trend = TrendEngine.analyze_trend(product)
    assert 0.0 <= trend["trend_score"] <= 100.0
    assert trend["direction"] in ["RISING", "STABLE", "FALLING"]

    scoring = ProductScoringEngine()
    score = scoring.evaluate(product)
    assert 0.0 <= score.overall_score <= 100.0
    assert len(score.ai_rationale) > 10

def test_content_strategy_and_compliance():
    provider = SeedCatalogProvider()
    product = provider.get_trending_products(limit=1)[0]

    variants = ContentStrategyEngine.generate_variants(product)
    assert len(variants) >= 4

    for var in variants:
        status, notes = ComplianceEngine.validate(var)
        assert status in [ComplianceStatus.PASSED, ComplianceStatus.WARN]
        assert any("FTC" in note for note in notes)

def test_video_rendering_ffmpeg():
    provider = SeedCatalogProvider()
    product = provider.get_trending_products(limit=1)[0]
    variant = ContentStrategyEngine.generate_variants(product)[0]

    output_mp4 = VideoEngine.render_short_video(product, variant, duration_sec=2)
    assert os.path.exists(output_mp4)
    assert os.path.getsize(output_mp4) > 1000  # Non-empty video file
