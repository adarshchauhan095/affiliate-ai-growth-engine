from typing import Dict, Any, Tuple
from app.database.models import Product, TrendDirection

class TrendEngine:
    """
    Evaluates product search momentum, velocity, discount-driven urgency,
    and classifies trend patterns.
    """

    @staticmethod
    def analyze_trend(product: Product) -> Dict[str, Any]:
        # Rating factor (0-30 pts)
        rating_score = min(30.0, max(0.0, (product.rating - 3.0) * 15.0))

        # Review volume credibility factor (0-25 pts)
        if product.review_count > 50000:
            vol_score = 25.0
        elif product.review_count > 10000:
            vol_score = 20.0
        elif product.review_count > 1000:
            vol_score = 15.0
        else:
            vol_score = 5.0

        # Deal / Discount urgency factor (0-30 pts)
        discount_score = min(30.0, (product.discount_percent / 70.0) * 30.0)

        # Base category multiplier (0-15 pts)
        high_velocity_categories = ["electronics", "mobile", "smartwatch", "kitchen", "audio"]
        cat_match = any(c in product.category.lower() for c in high_velocity_categories)
        cat_score = 15.0 if cat_match else 8.0

        trend_score = min(100.0, rating_score + vol_score + discount_score + cat_score)

        # Direction detection
        if trend_score >= 75.0 and product.discount_percent >= 30.0:
            direction = TrendDirection.RISING
            confidence = 0.88
            is_emerging = product.review_count < 25000
            is_high_opportunity = True
        elif trend_score >= 50.0:
            direction = TrendDirection.STABLE
            confidence = 0.75
            is_emerging = False
            is_high_opportunity = False
        else:
            direction = TrendDirection.FALLING
            confidence = 0.60
            is_emerging = False
            is_high_opportunity = False

        is_seasonal = "gift" in product.title.lower() or "festive" in product.title.lower() or "ac" in product.title.lower()

        return {
            "trend_score": round(trend_score, 1),
            "direction": direction,
            "confidence": confidence,
            "is_emerging": is_emerging,
            "is_high_opportunity": is_high_opportunity,
            "is_seasonal": is_seasonal
        }
