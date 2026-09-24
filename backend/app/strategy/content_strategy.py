import uuid
from typing import List
from datetime import datetime, timezone
from app.database.models import Product, ContentVariant, ContentAngle, ComplianceStatus, ApprovalStatus

class ContentStrategyEngine:
    """
    Formulates high-converting, original creative angles, hooks, scripts,
    and platform-specific variations for products.
    """

    @staticmethod
    def generate_variants(product: Product, angles: List[ContentAngle] = None) -> List[ContentVariant]:
        if not angles:
            angles = [
                ContentAngle.PROBLEM_SOLUTION,
                ContentAngle.TOP_3_BENEFITS,
                ContentAngle.PRICE_DROP,
                ContentAngle.MISTAKE_TO_AVOID
            ]

        variants = []
        disclosure = "As an Amazon Associate I earn from qualifying purchases. #ad #affiliate"

        for angle in angles:
            if angle == ContentAngle.PROBLEM_SOLUTION:
                hook = f"Stop wasting money on low-quality alternatives! Check out the {product.title[:45]}..."
                body = (
                    f"If you're tired of daily hassles, this {product.category.lower()} gadget completely solves it. "
                    f"Equipped with {product.features[0] if product.features else 'premium features'}, "
                    f"it delivers reliable performance for just ₹{product.current_price:.0f}."
                )
                cta = "Tap the link in bio or visit mybudgetdeal99 for the direct deal!"
                hashtags = ["#SmartFinds", "#AmazonDeals", "#BudgetFriendly", "#TechHacks", "#MustHave"]

            elif angle == ContentAngle.PRICE_DROP:
                hook = f"HUGE PRICE DROP ALERT! {product.title[:45]} is now {product.discount_percent:.0f}% OFF!"
                body = (
                    f"Original price was ₹{product.original_price:.0f}, but right now it's down to ₹{product.current_price:.0f}! "
                    f"Rated {product.rating}★ by over {product.review_count:,} happy customers. "
                    f"Key highlight: {product.features[0] if product.features else 'High durability'}."
                )
                cta = "Grab this before the price goes back up! Link in bio."
                hashtags = ["#PriceDrop", "#AmazonSale", "#BudgetDeal", "#SaveMoney", "#DealAlert"]

            elif angle == ContentAngle.TOP_3_BENEFITS:
                hook = f"3 reasons why everyone is buying this ₹{product.current_price:.0f} {product.category.split('&')[0].strip()}!"
                f1 = product.features[0] if len(product.features) > 0 else "Unbeatable build quality"
                f2 = product.features[1] if len(product.features) > 1 else "Massive battery and efficiency"
                f3 = product.features[2] if len(product.features) > 2 else "Best-in-class value for price"
                body = f"1: {f1}.\n2: {f2}.\n3: {f3}.\nAll under ₹{product.current_price:.0f} on Amazon right now."
                cta = "Check out the full specs via the link in our bio!"
                hashtags = ["#ProductReview", "#Top3", "#BestDeals", "#AmazonIndia", "#LifeHacks"]

            elif angle == ContentAngle.MISTAKE_TO_AVOID:
                hook = f"The biggest mistake people make when buying a {product.category.split('&')[0].strip()} in 2026..."
                body = (
                    f"Don't overpay ₹5,000 for brand names when the {product.title[:35]} gives you "
                    f"{product.features[0] if product.features else 'all top specs'} at just ₹{product.current_price:.0f}."
                )
                cta = "Save your money! Full link in bio."
                hashtags = ["#BuyerBeware", "#SmartShopping", "#MoneySavingTips", "#DealOfTheDay"]

            else:
                hook = f"Discover why the {product.title[:45]} is trending today!"
                body = f"Currently ₹{product.current_price:.0f} with a massive {product.discount_percent:.0f}% discount."
                cta = "Get yours today via the link in bio."
                hashtags = ["#TrendingNow", "#AmazonFinds", "#HotDeals"]

            variant = ContentVariant(
                id=f"var_{uuid.uuid4().hex[:10]}",
                product_id=product.id,
                angle_type=angle,
                hook_text=hook,
                body_script=body,
                cta_text=cta,
                disclosure_text=disclosure,
                hashtags=hashtags,
                compliance_status=ComplianceStatus.PENDING,
                compliance_notes=[],
                approval_status=ApprovalStatus.PENDING_APPROVAL,
                created_at=datetime.now(timezone.utc)
            )
            variants.append(variant)

        return variants
