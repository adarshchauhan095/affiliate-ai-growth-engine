import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import settings
from app.database.db import db
from app.database.models import (
    Product, ProductScore, ContentVariant, PublishingJob,
    JobStatus, ApprovalStatus, PlatformType, GrowthStrategy,
    ComplianceStatus
)
from app.discovery.seed_catalog import SeedCatalogProvider
from app.discovery.url_normalizer import extract_asin, build_affiliate_url
from app.intelligence.scoring_engine import ProductScoringEngine
from app.strategy.content_strategy import ContentStrategyEngine
from app.compliance.compliance_engine import ComplianceEngine
from app.worker.queue import JobQueue
from app.worker.worker_daemon import worker
from app.analytics.attribution import AttributionEngine
from app.analytics.growth_engine import GrowthEngine
from app.analytics.ab_testing import ABTestingEngine

app = FastAPI(
    title="AI Affiliate Growth Engine API",
    description="Autonomous product discovery, scoring, video creation, multi-platform publishing, and growth optimization",
    version="1.0.0"
)

# CORS middleware for modern frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local media directory for live video/image previews
media_path = Path(settings.MEDIA_RENDER_DIR)
media_path.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_path)), name="media")



# Request Models
class UrlImportRequest(BaseModel):
    url_or_asin: str
    category: Optional[str] = "Imported Deals"

class ApprovalRequest(BaseModel):
    action: str  # APPROVE or REJECT
    approved_by: Optional[str] = "HUMAN_OPERATOR"

class ScheduleJobRequest(BaseModel):
    variant_id: str
    product_id: str
    platform: PlatformType

# 1. Health & Telemetry
@app.get("/api/health")
def get_health():
    return {
        "status": "HEALTHY",
        "app": "AI Affiliate Growth Engine",
        "env": settings.APP_ENV,
        "associate_tag": settings.AMAZON_ASSOCIATE_TAG,
        "approval_mode": settings.APPROVAL_MODE,
        "telemetry": worker.get_telemetry()
    }

# 2. Product Discovery & Ingestion
@app.get("/api/products", response_model=List[Product])
def list_products(limit: int = 50):
    prods = db.list_products(limit=limit)
    if not prods:
        # Auto-seed from catalog on first launch
        provider = SeedCatalogProvider()
        seeds = provider.get_trending_products(limit=10)
        scoring = ProductScoringEngine()
        for p in seeds:
            score = scoring.evaluate(p)
            p.latest_score = score.overall_score
            db.upsert_product(p)
            db.add_score(score)
        prods = db.list_products(limit=limit)
    return prods

@app.post("/api/products/discover")
def trigger_discovery(query: Optional[str] = None, category: Optional[str] = None):
    provider = SeedCatalogProvider()
    if query:
        products = provider.search_products(query, category=category, limit=10)
    else:
        products = provider.get_trending_products(category=category, limit=10)

    scoring = ProductScoringEngine()
    saved = []
    for p in products:
        score = scoring.evaluate(p)
        p.latest_score = score.overall_score
        db.upsert_product(p)
        db.add_score(score)
        saved.append(p)
    return {"discovered_count": len(saved), "products": saved}

@app.post("/api/products/import-url")
def import_url_product(req: UrlImportRequest):
    asin = extract_asin(req.url_or_asin)
    if not asin:
        raise HTTPException(status_code=400, detail="Could not extract valid 10-character Amazon ASIN from provided URL or string.")

    affiliate_url, canonical_url = build_affiliate_url(
        asin=asin,
        tag=settings.AMAZON_ASSOCIATE_TAG,
        marketplace=settings.AMAZON_MARKETPLACE
    )

    from datetime import datetime, timezone
    product = Product(
        id=f"prod_{asin}",
        asin=asin,
        title=f"Amazon Verified Product ({asin})",
        category=req.category or "Special Deals",
        original_price=999.0,
        current_price=499.0,
        currency="INR",
        discount_percent=50.0,
        rating=4.3,
        review_count=5200,
        affiliate_url=affiliate_url,
        canonical_url=canonical_url,
        features=["Amazon Verified Top Deal", "Fast Shipping Eligible", "Affiliate Link Embedded"],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )

    scoring = ProductScoringEngine()
    score = scoring.evaluate(product)
    product.latest_score = score.overall_score

    db.upsert_product(product)
    db.add_score(score)
    return {"message": "Product successfully imported and scored", "product": product, "score": score}

# 3. Content Strategy & Generation
@app.post("/api/products/{product_id}/generate-content")
def generate_content(product_id: str):
    product = db.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    variants = ContentStrategyEngine.generate_variants(product)
    saved_variants = []
    for var in variants:
        # Pre-validate compliance
        status, notes = ComplianceEngine.validate(var)
        var.compliance_status = status
        var.compliance_notes = notes

        # Check semi-auto approval
        if settings.APPROVAL_MODE == "AUTONOMOUS" or (settings.APPROVAL_MODE == "SEMI_AUTOMATIC" and status == ComplianceStatus.PASSED and product.latest_score >= 70):
            var.approval_status = ApprovalStatus.APPROVED
            var.approved_by = "AUTO_ENGINE"

        db.add_content_variant(var)
        saved_variants.append(var)

    return {"product_id": product_id, "generated_variants_count": len(saved_variants), "variants": saved_variants}

@app.get("/api/variants", response_model=List[ContentVariant])
def list_variants(product_id: Optional[str] = None):
    return db.list_content_variants(product_id=product_id)

@app.post("/api/variants/{variant_id}/approval")
def set_approval(variant_id: str, req: ApprovalRequest):
    var = db.get_content_variant(variant_id)
    if not var:
        raise HTTPException(status_code=404, detail="Variant not found")

    status = ApprovalStatus.APPROVED if req.action.upper() == "APPROVE" else ApprovalStatus.REJECTED
    db.update_variant_approval(variant_id, status, req.approved_by or "HUMAN")
    return {"variant_id": variant_id, "approval_status": status.value}

# 4. Publishing & Worker Queue
@app.post("/api/jobs/schedule")
def schedule_publishing(req: ScheduleJobRequest):
    variant = db.get_content_variant(req.variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    job = JobQueue.schedule_job(
        variant_id=req.variant_id,
        product_id=req.product_id,
        platform=req.platform
    )
    return {"message": "Job successfully scheduled", "job": job}

@app.get("/api/jobs")
def list_jobs():
    return db.list_pending_jobs()

@app.post("/api/worker/process-next")
def process_next_job():
    jobs = JobQueue.get_next_jobs(limit=1)
    if not jobs:
        return {"message": "No pending jobs in queue"}

    job = jobs[0]
    result = worker.process_single_job(job.id)
    return {"job_id": job.id, "result": result}

# 5. Analytics, Attribution & Growth
@app.get("/api/analytics/summary")
def get_analytics_summary():
    summary = db.get_summary_analytics()
    platforms = AttributionEngine.get_performance_by_platform()
    products = AttributionEngine.get_performance_by_product()
    return {
        "metrics": summary,
        "platforms": platforms,
        "top_products": products
    }

@app.get("/api/growth/strategies")
def get_growth_strategies():
    return db.list_growth_strategies()

@app.post("/api/growth/evaluate")
def trigger_growth_evaluation():
    strategies = GrowthEngine.evaluate_and_generate_strategies()
    return {"generated_strategies_count": len(strategies), "strategies": strategies}

@app.get("/api/analytics/ab-test/{product_id}")
def get_ab_test_results(product_id: str):
    return ABTestingEngine.compare_variants(product_id)

# Mount frontend web dashboard at root
frontend_dir = Path(__file__).resolve().parent.parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
