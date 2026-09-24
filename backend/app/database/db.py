import sqlite3
import json
import threading
from pathlib import Path
from typing import List, Optional, Dict, Any
from app.config import settings
from app.database.models import (
    Product, ProductScore, ContentVariant, PublishingJob,
    AnalyticsRecord, GrowthStrategy, JobStatus, ApprovalStatus
)

class Database:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(Database, cls).__new__(cls)
                cls._instance._init_db()
            return cls._instance

    def _get_connection(self) -> sqlite3.Connection:
        db_path = Path(settings.DATA_DIR) / "growth_engine.db"
        conn = sqlite3.connect(str(db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.executescript("""
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            asin TEXT UNIQUE,
            title TEXT,
            category TEXT,
            original_price REAL,
            current_price REAL,
            currency TEXT,
            discount_percent REAL,
            rating REAL,
            review_count INTEGER,
            affiliate_url TEXT,
            canonical_url TEXT,
            image_urls TEXT,
            features TEXT,
            availability TEXT,
            discovery_source TEXT,
            latest_score REAL,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS product_scores (
            id TEXT PRIMARY KEY,
            product_id TEXT,
            demand_score REAL,
            trend_score REAL,
            competition_score REAL,
            monetization_score REAL,
            content_potential_score REAL,
            conversion_potential_score REAL,
            overall_score REAL,
            scoring_weights_version TEXT,
            ai_rationale TEXT,
            calculated_at TEXT,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS content_variants (
            id TEXT PRIMARY KEY,
            product_id TEXT,
            angle_type TEXT,
            hook_text TEXT,
            body_script TEXT,
            cta_text TEXT,
            disclosure_text TEXT,
            hashtags TEXT,
            media_path TEXT,
            thumbnail_path TEXT,
            compliance_status TEXT,
            compliance_notes TEXT,
            approval_status TEXT,
            approved_by TEXT,
            created_at TEXT,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS publishing_jobs (
            id TEXT PRIMARY KEY,
            content_variant_id TEXT,
            product_id TEXT,
            platform TEXT,
            scheduled_time TEXT,
            status TEXT,
            attempt_count INTEGER,
            max_attempts INTEGER,
            idempotency_key TEXT UNIQUE,
            platform_post_id TEXT,
            platform_post_url TEXT,
            error_message TEXT,
            published_at TEXT,
            FOREIGN KEY (content_variant_id) REFERENCES content_variants(id)
        );

        CREATE TABLE IF NOT EXISTS analytics_records (
            id TEXT PRIMARY KEY,
            job_id TEXT,
            product_id TEXT,
            platform TEXT,
            views INTEGER,
            impressions INTEGER,
            likes INTEGER,
            comments INTEGER,
            shares INTEGER,
            clicks INTEGER,
            affiliate_clicks INTEGER,
            affiliate_orders INTEGER,
            revenue REAL,
            collected_at TEXT
        );

        CREATE TABLE IF NOT EXISTS growth_strategies (
            id TEXT PRIMARY KEY,
            type TEXT,
            priority TEXT,
            rationale TEXT,
            proposed_action TEXT,
            affected_product_id TEXT,
            affected_platform TEXT,
            status TEXT,
            created_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_products_score ON products(latest_score DESC);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON publishing_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_content_approval ON content_variants(approval_status);
        """)
        conn.commit()
        conn.close()

    # Product Operations
    def upsert_product(self, product: Product) -> Product:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO products (
                id, asin, title, category, original_price, current_price, currency,
                discount_percent, rating, review_count, affiliate_url, canonical_url,
                image_urls, features, availability, discovery_source, latest_score,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(asin) DO UPDATE SET
                title=excluded.title,
                category=excluded.category,
                original_price=excluded.original_price,
                current_price=excluded.current_price,
                discount_percent=excluded.discount_percent,
                rating=excluded.rating,
                review_count=excluded.review_count,
                affiliate_url=excluded.affiliate_url,
                latest_score=excluded.latest_score,
                updated_at=excluded.updated_at
        """, (
            product.id, product.asin, product.title, product.category,
            product.original_price, product.current_price, product.currency,
            product.discount_percent, product.rating, product.review_count,
            product.affiliate_url, product.canonical_url,
            json.dumps(product.image_urls), json.dumps(product.features),
            product.availability.value, product.discovery_source.value,
            product.latest_score, product.created_at.isoformat(),
            product.updated_at.isoformat()
        ))
        conn.commit()
        conn.close()
        return product

    def get_product(self, product_id: str) -> Optional[Product]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products WHERE id = ? OR asin = ?", (product_id, product_id))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        data = dict(row)
        data["image_urls"] = json.loads(data["image_urls"] or "[]")
        data["features"] = json.loads(data["features"] or "[]")
        return Product(**data)

    def list_products(self, limit: int = 50, sort_by_score: bool = True) -> List[Product]:
        conn = self._get_connection()
        cursor = conn.cursor()
        query = "SELECT * FROM products"
        if sort_by_score:
            query += " ORDER BY latest_score DESC"
        query += f" LIMIT {limit}"
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        products = []
        for row in rows:
            data = dict(row)
            data["image_urls"] = json.loads(data["image_urls"] or "[]")
            data["features"] = json.loads(data["features"] or "[]")
            products.append(Product(**data))
        return products

    # Score Operations
    def add_score(self, score: ProductScore) -> ProductScore:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO product_scores (
                id, product_id, demand_score, trend_score, competition_score,
                monetization_score, content_potential_score, conversion_potential_score,
                overall_score, scoring_weights_version, ai_rationale, calculated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            score.id, score.product_id, score.demand_score, score.trend_score,
            score.competition_score, score.monetization_score, score.content_potential_score,
            score.conversion_potential_score, score.overall_score,
            score.scoring_weights_version, score.ai_rationale, score.calculated_at.isoformat()
        ))
        # Update latest score on product
        cursor.execute("UPDATE products SET latest_score = ? WHERE id = ?", (score.overall_score, score.product_id))
        conn.commit()
        conn.close()
        return score

    # Content Variant Operations
    def add_content_variant(self, variant: ContentVariant) -> ContentVariant:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO content_variants (
                id, product_id, angle_type, hook_text, body_script, cta_text,
                disclosure_text, hashtags, media_path, thumbnail_path,
                compliance_status, compliance_notes, approval_status, approved_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            variant.id, variant.product_id, variant.angle_type.value,
            variant.hook_text, variant.body_script, variant.cta_text,
            variant.disclosure_text, json.dumps(variant.hashtags),
            variant.media_path, variant.thumbnail_path,
            variant.compliance_status.value, json.dumps(variant.compliance_notes),
            variant.approval_status.value, variant.approved_by,
            variant.created_at.isoformat()
        ))
        conn.commit()
        conn.close()
        return variant

    def get_content_variant(self, variant_id: str) -> Optional[ContentVariant]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM content_variants WHERE id = ?", (variant_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        data = dict(row)
        data["hashtags"] = json.loads(data["hashtags"] or "[]")
        data["compliance_notes"] = json.loads(data["compliance_notes"] or "[]")
        return ContentVariant(**data)

    def list_content_variants(self, product_id: Optional[str] = None, approval_status: Optional[ApprovalStatus] = None) -> List[ContentVariant]:
        conn = self._get_connection()
        cursor = conn.cursor()
        query = "SELECT * FROM content_variants WHERE 1=1"
        params = []
        if product_id:
            query += " AND product_id = ?"
            params.append(product_id)
        if approval_status:
            query += " AND approval_status = ?"
            params.append(approval_status.value)
        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        variants = []
        for r in rows:
            d = dict(r)
            d["hashtags"] = json.loads(d["hashtags"] or "[]")
            d["compliance_notes"] = json.loads(d["compliance_notes"] or "[]")
            variants.append(ContentVariant(**d))
        return variants

    def update_variant_approval(self, variant_id: str, status: ApprovalStatus, approved_by: str):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE content_variants SET approval_status = ?, approved_by = ? WHERE id = ?", (status.value, approved_by, variant_id))
        conn.commit()
        conn.close()

    # Publishing Job Operations
    def add_publishing_job(self, job: PublishingJob) -> PublishingJob:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR IGNORE INTO publishing_jobs (
                id, content_variant_id, product_id, platform, scheduled_time,
                status, attempt_count, max_attempts, idempotency_key,
                platform_post_id, platform_post_url, error_message, published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            job.id, job.content_variant_id, job.product_id, job.platform.value,
            job.scheduled_time.isoformat(), job.status.value, job.attempt_count,
            job.max_attempts, job.idempotency_key, job.platform_post_id,
            job.platform_post_url, job.error_message,
            job.published_at.isoformat() if job.published_at else None
        ))
        conn.commit()
        conn.close()
        return job

    def list_pending_jobs(self) -> List[PublishingJob]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM publishing_jobs WHERE status IN ('PENDING', 'SCHEDULED') ORDER BY scheduled_time ASC")
        rows = cursor.fetchall()
        conn.close()
        return [PublishingJob(**dict(r)) for r in rows]

    def update_job_status(self, job_id: str, status: JobStatus, error_message: Optional[str] = None, platform_post_id: Optional[str] = None, platform_post_url: Optional[str] = None):
        conn = self._get_connection()
        cursor = conn.cursor()
        from datetime import datetime, timezone
        now_str = datetime.now(timezone.utc).isoformat() if status == JobStatus.PUBLISHED else None
        cursor.execute("""
            UPDATE publishing_jobs
            SET status = ?, error_message = ?, platform_post_id = ?, platform_post_url = ?, published_at = ?
            WHERE id = ?
        """, (status.value, error_message, platform_post_id, platform_post_url, now_str, job_id))
        conn.commit()
        conn.close()

    # Analytics & Growth
    def record_analytics(self, record: AnalyticsRecord):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO analytics_records (
                id, job_id, product_id, platform, views, impressions,
                likes, comments, shares, clicks, affiliate_clicks,
                affiliate_orders, revenue, collected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record.id, record.job_id, record.product_id, record.platform.value,
            record.views, record.impressions, record.likes, record.comments,
            record.shares, record.clicks, record.affiliate_clicks,
            record.affiliate_orders, record.revenue, record.collected_at.isoformat()
        ))
        conn.commit()
        conn.close()

    def get_summary_analytics(self) -> Dict[str, Any]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                COALESCE(SUM(views), 0) as total_views,
                COALESCE(SUM(clicks), 0) as total_clicks,
                COALESCE(SUM(affiliate_clicks), 0) as total_affiliate_clicks,
                COALESCE(SUM(affiliate_orders), 0) as total_orders,
                COALESCE(SUM(revenue), 0.0) as total_revenue
            FROM analytics_records
        """)
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else {
            "total_views": 0, "total_clicks": 0,
            "total_affiliate_clicks": 0, "total_orders": 0, "total_revenue": 0.0
        }

    def add_growth_strategy(self, strategy: GrowthStrategy):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO growth_strategies (
                id, type, priority, rationale, proposed_action,
                affected_product_id, affected_platform, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            strategy.id, strategy.type, strategy.priority, strategy.rationale,
            strategy.proposed_action, strategy.affected_product_id,
            strategy.affected_platform.value if strategy.affected_platform else None,
            strategy.status, strategy.created_at.isoformat()
        ))
        conn.commit()
        conn.close()

    def list_growth_strategies(self) -> List[GrowthStrategy]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM growth_strategies ORDER BY created_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return [GrowthStrategy(**dict(r)) for r in rows]

db = Database()
