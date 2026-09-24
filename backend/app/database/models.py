from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class AvailabilityStatus(str, Enum):
    IN_STOCK = "IN_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    LOW_STOCK = "LOW_STOCK"
    UNKNOWN = "UNKNOWN"

class DiscoverySource(str, Enum):
    MANUAL_SEED = "MANUAL_SEED"
    RSS_FEED = "RSS_FEED"
    URL_IMPORT = "URL_IMPORT"
    PA_API = "PA_API"

class TrendDirection(str, Enum):
    RISING = "RISING"
    STABLE = "STABLE"
    FALLING = "FALLING"

class ContentAngle(str, Enum):
    PROBLEM_SOLUTION = "PROBLEM_SOLUTION"
    TOP_3_BENEFITS = "TOP_3_BENEFITS"
    PRICE_DROP = "PRICE_DROP"
    MISTAKE_TO_AVOID = "MISTAKE_TO_AVOID"
    COMPARISON = "COMPARISON"
    GIFT_GUIDE = "GIFT_GUIDE"

class ComplianceStatus(str, Enum):
    PENDING = "PENDING"
    PASSED = "PASSED"
    WARN = "WARN"
    BLOCKED = "BLOCKED"

class ApprovalStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class PlatformType(str, Enum):
    INSTAGRAM = "INSTAGRAM"
    YOUTUBE = "YOUTUBE"
    FACEBOOK = "FACEBOOK"
    PINTEREST = "PINTEREST"
    GITHUB_PAGES = "GITHUB_PAGES"

class JobStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

# Product Entities
class Product(BaseModel):
    id: str
    asin: str
    title: str
    category: str
    original_price: float = 0.0
    current_price: float = 0.0
    currency: str = "INR"
    discount_percent: float = 0.0
    rating: float = 4.0
    review_count: int = 100
    affiliate_url: str
    canonical_url: str
    image_urls: List[str] = Field(default_factory=list)
    features: List[str] = Field(default_factory=list)
    availability: AvailabilityStatus = AvailabilityStatus.IN_STOCK
    discovery_source: DiscoverySource = DiscoverySource.MANUAL_SEED
    latest_score: float = 0.0
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

class ProductScore(BaseModel):
    id: str
    product_id: str
    demand_score: float
    trend_score: float
    competition_score: float
    monetization_score: float
    content_potential_score: float
    conversion_potential_score: float
    overall_score: float
    scoring_weights_version: str = "v1.0"
    ai_rationale: str
    calculated_at: datetime = Field(default_factory=utc_now)

# Content & Creative Entities
class ContentVariant(BaseModel):
    id: str
    product_id: str
    angle_type: ContentAngle
    hook_text: str
    body_script: str
    cta_text: str
    disclosure_text: str
    hashtags: List[str] = Field(default_factory=list)
    media_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    compliance_status: ComplianceStatus = ComplianceStatus.PENDING
    compliance_notes: List[str] = Field(default_factory=list)
    approval_status: ApprovalStatus = ApprovalStatus.PENDING_APPROVAL
    approved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)

# Publishing & Queue Entities
class PublishingJob(BaseModel):
    id: str
    content_variant_id: str
    product_id: str
    platform: PlatformType
    scheduled_time: datetime
    status: JobStatus = JobStatus.SCHEDULED
    attempt_count: int = 0
    max_attempts: int = 3
    idempotency_key: str
    platform_post_id: Optional[str] = None
    platform_post_url: Optional[str] = None
    error_message: Optional[str] = None
    published_at: Optional[datetime] = None

# Analytics & Attribution
class AnalyticsRecord(BaseModel):
    id: str
    job_id: str
    product_id: str
    platform: PlatformType
    views: int = 0
    impressions: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    affiliate_clicks: int = 0
    affiliate_orders: int = 0
    revenue: float = 0.0
    collected_at: datetime = Field(default_factory=datetime.utcnow)

# Growth Strategy
class GrowthStrategy(BaseModel):
    id: str
    type: str
    priority: str = "HIGH"
    rationale: str
    proposed_action: str
    affected_product_id: Optional[str] = None
    affected_platform: Optional[PlatformType] = None
    status: str = "PROPOSED"
    created_at: datetime = Field(default_factory=datetime.utcnow)
