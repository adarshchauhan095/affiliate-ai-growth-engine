from typing import Dict, Any, List
from app.database.db import db

class ABTestingEngine:
    """
    Evaluates creative variants performance and computes statistical winners.
    """

    @staticmethod
    def compare_variants(product_id: str) -> Dict[str, Any]:
        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                v.id as variant_id,
                v.angle_type,
                v.hook_text,
                COALESCE(SUM(a.views), 0) as views,
                COALESCE(SUM(a.clicks), 0) as clicks,
                COALESCE(SUM(a.affiliate_orders), 0) as orders,
                COALESCE(SUM(a.revenue), 0.0) as revenue
            FROM content_variants v
            LEFT JOIN publishing_jobs j ON j.content_variant_id = v.id
            LEFT JOIN analytics_records a ON a.job_id = j.id
            WHERE v.product_id = ?
            GROUP BY v.id
        """, (product_id,))
        rows = cursor.fetchall()
        conn.close()

        variants = []
        winner = None
        highest_score = -1.0

        for r in rows:
            views = r["views"]
            clicks = r["clicks"]
            ctr = (clicks / views * 100.0) if views > 0 else 0.0
            rev = r["revenue"]

            # Multi-objective score: 40% CTR + 60% Revenue
            score = (ctr * 0.4) + (rev * 0.6)

            v_info = {
                "variant_id": r["variant_id"],
                "angle_type": r["angle_type"],
                "hook_text": r["hook_text"],
                "views": views,
                "clicks": clicks,
                "ctr_pct": round(ctr, 2),
                "orders": r["orders"],
                "revenue": round(rev, 2),
                "composite_score": round(score, 2)
            }
            variants.append(v_info)

            if score > highest_score and views >= 100:  # Minimum sample size
                highest_score = score
                winner = v_info

        return {
            "product_id": product_id,
            "total_variants_evaluated": len(variants),
            "winner": winner,
            "variants": variants
        }
