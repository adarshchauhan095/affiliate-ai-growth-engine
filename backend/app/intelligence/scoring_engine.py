import uuid
from typing import Dict, Optional
from datetime import datetime, timezone
from app.database.models import Product, ProductScore
from app.intelligence.trend_engine import TrendEngine

DEFAULT_WEIGHTS = {
    "demand": 0.25,
    "trend": 0.20,
    "competition": 0.10,
    "monetization": 0.15,
    "content_potential": 0.10,
    "conversion_potential": 0.10,
    "seasonality": 0.10
}

class ProductScoringEngine:
    """
    Computes multi-factor profitability, demand, and virality potential
    with configurable weights and explainable AI narrative.
    """

    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or DEFAULT_WEIGHTS

    def evaluate(self, product: Product) -> ProductScore:
        trend_data = TrendEngine.analyze_trend(product)
        trend_score = trend_data["trend_score"]

        # 1. Demand Score (0-100): rating + review count saturation
        demand_score = min(100.0, (product.rating / 5.0) * 50.0 + min(50.0, (product.review_count / 100000.0) * 50.0))

        # 2. Competition Score (0-100): High score = healthy competition / high market size
        comp_score = 75.0 if product.review_count > 5000 else 60.0

        # 3. Monetization Score (0-100): Margin, price sweet spot (199 - 2500 INR is high-converting budget impulse buy)
        if 199.0 <= product.current_price <= 1999.0:
            monetization_score = 90.0
        elif product.current_price < 199.0:
            monetization_score = 65.0
        else:
            monetization_score = 80.0

        # 4. Content Potential Score (0-100): Feature count, visual appeal, problem-solving capability
        content_score = min(100.0, 50.0 + (len(product.features) * 12.0))

        # 5. Conversion Potential (0-100): Discount depth + rating reliability
        conv_score = min(100.0, (product.discount_percent * 0.7) + (product.rating * 10.0))

        # 6. Seasonality factor
        season_score = 85.0 if trend_data["is_seasonal"] or trend_data["is_high_opportunity"] else 70.0

        # Weighted calculation
        overall = (
            demand_score * self.weights.get("demand", 0.25) +
            trend_score * self.weights.get("trend", 0.20) +
            comp_score * self.weights.get("competition", 0.10) +
            monetization_score * self.weights.get("monetization", 0.15) +
            content_score * self.weights.get("content_potential", 0.10) +
            conv_score * self.weights.get("conversion_potential", 0.10) +
            season_score * self.weights.get("seasonality", 0.10)
        )
        overall = round(min(100.0, max(0.0, overall)), 1)

        # Explainable AI Rationale
        reasons = []
        if product.discount_percent >= 40.0:
            reasons.append(f"Deep discount of {product.discount_percent}% drives acute buying urgency")
        if product.rating >= 4.2:
            reasons.append(f"High social proof with {product.rating}★ rating across {product.review_count:,} verified reviews")
        if 199.0 <= product.current_price <= 1500.0:
            reasons.append(f"Ideal impulse-buy price bracket (₹{product.current_price:.0f})")
        if trend_data["is_high_opportunity"]:
            reasons.append("Identified as a high-opportunity rising trend product")

        rationale = "; ".join(reasons) if reasons else "Solid all-round performance with balanced demand and conversion indicators."

        return ProductScore(
            id=f"score_{uuid.uuid4().hex[:10]}",
            product_id=product.id,
            demand_score=round(demand_score, 1),
            trend_score=round(trend_score, 1),
            competition_score=round(comp_score, 1),
            monetization_score=round(monetization_score, 1),
            content_potential_score=round(content_score, 1),
            conversion_potential_score=round(conv_score, 1),
            overall_score=overall,
            scoring_weights_version="v1.0",
            ai_rationale=rationale,
            calculated_at=datetime.now(timezone.utc)
        )
