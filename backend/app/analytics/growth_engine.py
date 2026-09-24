import uuid
from typing import List
from datetime import datetime, timezone
from app.database.db import db
from app.database.models import GrowthStrategy, PlatformType
from app.analytics.attribution import AttributionEngine

class GrowthEngine:
    """
    Continuous AI Growth Engine.
    Executes automated performance analysis and generates strategic recommendations
    to maximize affiliate revenue and ROI.
    """

    @classmethod
    def evaluate_and_generate_strategies(cls) -> List[GrowthStrategy]:
        strategies: List[GrowthStrategy] = []
        product_perf = AttributionEngine.get_performance_by_product()

        for prod in product_perf:
            pid = prod["product_id"]
            views = prod["views"]
            clicks = prod["clicks"]
            aff_clicks = prod["affiliate_clicks"]
            orders = prod["orders"]
            rev = prod["revenue"]

            # Rule 1: High views, low CTR -> Improve Call to Action
            if views > 2000 and (clicks / views) < 0.015:
                strat = GrowthStrategy(
                    id=f"strat_{uuid.uuid4().hex[:10]}",
                    type="OPTIMIZE_CTA",
                    priority="HIGH",
                    rationale=f"Product '{prod['title'][:35]}' has strong reach ({views:,} views) but weak CTR ({((clicks/views)*100):.1f}%).",
                    proposed_action="Swap current CTA with a direct price-drop incentive banner e.g. 'Get ₹500 off before midnight'.",
                    affected_product_id=pid,
                    status="PROPOSED",
                    created_at=datetime.now(timezone.utc)
                )
                db.add_growth_strategy(strat)
                strategies.append(strat)

            # Rule 2: High conversion rate -> Scale content variations
            if aff_clicks >= 20 and prod["conversion_rate_pct"] >= 5.0:
                strat = GrowthStrategy(
                    id=f"strat_{uuid.uuid4().hex[:10]}",
                    type="SCALE_CREATIVES",
                    priority="HIGH",
                    rationale=f"Exceptional conversion rate of {prod['conversion_rate_pct']}% on product '{prod['title'][:35]}'.",
                    proposed_action="Generate 3 additional creative angles (Problem/Solution, Buying Guide, Comparison) to maximize conversion volume.",
                    affected_product_id=pid,
                    status="PROPOSED",
                    created_at=datetime.now(timezone.utc)
                )
                db.add_growth_strategy(strat)
                strategies.append(strat)

            # Rule 3: High revenue winner -> Cross-post to remaining platforms
            if rev >= 1500.0:
                strat = GrowthStrategy(
                    id=f"strat_{uuid.uuid4().hex[:10]}",
                    type="EXPAND_DISTRIBUTION",
                    priority="HIGH",
                    rationale=f"Product generated ₹{rev:.0f} in commissions. High organic monetization product.",
                    proposed_action="Schedule automated cross-distribution on YouTube Shorts and Pinterest Boards.",
                    affected_product_id=pid,
                    status="PROPOSED",
                    created_at=datetime.now(timezone.utc)
                )
                db.add_growth_strategy(strat)
                strategies.append(strat)

        return strategies
