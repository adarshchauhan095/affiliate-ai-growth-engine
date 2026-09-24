from typing import Dict, Any, List
from app.database.db import db
from app.database.models import PlatformType

class AttributionEngine:
    """
    Computes revenue attribution, RPC (Revenue Per Click),
    RPM (Revenue Per Mille Views), and conversion rates across channels.
    """

    @staticmethod
    def get_performance_by_platform() -> List[Dict[str, Any]]:
        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                platform,
                COUNT(id) as total_posts,
                SUM(views) as total_views,
                SUM(clicks) as total_clicks,
                SUM(affiliate_clicks) as total_aff_clicks,
                SUM(affiliate_orders) as total_orders,
                SUM(revenue) as total_revenue
            FROM analytics_records
            GROUP BY platform
        """)
        rows = cursor.fetchall()
        conn.close()

        results = []
        for r in rows:
            views = r["total_views"] or 0
            clicks = r["total_clicks"] or 0
            aff_clicks = r["total_aff_clicks"] or 0
            orders = r["total_orders"] or 0
            rev = r["total_revenue"] or 0.0

            cvr = round((orders / aff_clicks * 100.0), 2) if aff_clicks > 0 else 0.0
            rpm = round((rev / (views / 1000.0)), 2) if views >= 1000 else 0.0
            rpc = round((rev / aff_clicks), 2) if aff_clicks > 0 else 0.0

            results.append({
                "platform": r["platform"],
                "total_posts": r["total_posts"],
                "views": views,
                "clicks": clicks,
                "affiliate_clicks": aff_clicks,
                "orders": orders,
                "revenue": round(rev, 2),
                "conversion_rate_pct": cvr,
                "rpm": rpm,
                "rpc": rpc
            })
        return results

    @staticmethod
    def get_performance_by_product() -> List[Dict[str, Any]]:
        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                a.product_id,
                p.title,
                p.current_price,
                p.latest_score,
                SUM(a.views) as total_views,
                SUM(a.clicks) as total_clicks,
                SUM(a.affiliate_clicks) as total_aff_clicks,
                SUM(a.affiliate_orders) as total_orders,
                SUM(a.revenue) as total_revenue
            FROM analytics_records a
            LEFT JOIN products p ON a.product_id = p.id
            GROUP BY a.product_id
        """)
        rows = cursor.fetchall()
        conn.close()

        products = []
        for r in rows:
            aff_clicks = r["total_aff_clicks"] or 0
            orders = r["total_orders"] or 0
            rev = r["total_revenue"] or 0.0
            cvr = round((orders / aff_clicks * 100.0), 2) if aff_clicks > 0 else 0.0

            products.append({
                "product_id": r["product_id"],
                "title": r["title"] or "Unknown Product",
                "price": r["current_price"] or 0.0,
                "score": r["latest_score"] or 0.0,
                "views": r["total_views"] or 0,
                "clicks": r["total_clicks"] or 0,
                "affiliate_clicks": aff_clicks,
                "orders": orders,
                "revenue": round(rev, 2),
                "conversion_rate_pct": cvr
            })
        return products
