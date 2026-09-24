import os
import shutil
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.config import settings
from app.database.db import db
from app.database.models import (
    JobStatus, PlatformType, ApprovalStatus, ComplianceStatus,
    AnalyticsRecord, PublishingJob
)
from app.worker.queue import JobQueue
from app.media.video_engine import VideoEngine
from app.compliance.compliance_engine import ComplianceEngine
from app.publishing.instagram import InstagramPublisher
from app.publishing.youtube import YouTubePublisher
from app.publishing.github_pages import GitHubPagesPublisher

logger = logging.getLogger(__name__)

class WorkerDaemon:
    """
    Local automation worker daemon.
    Executes media generation, approval enforcement, publishing dispatch,
    and reports live hardware telemetry.
    """

    def __init__(self):
        self.publishers = {
            PlatformType.INSTAGRAM: InstagramPublisher(),
            PlatformType.YOUTUBE: YouTubePublisher(),
            PlatformType.GITHUB_PAGES: GitHubPagesPublisher()
        }
        self.current_job_id: Optional[str] = None
        self.last_heartbeat: datetime = datetime.now(timezone.utc)
        self.is_running: bool = False

    def get_telemetry(self) -> Dict[str, Any]:
        """Collect local hardware and worker status metrics."""
        self.last_heartbeat = datetime.now(timezone.utc)
        total, used, free = shutil.disk_usage(settings.STORAGE_BASE_DIR)

        pending_count = len(JobQueue.get_next_jobs(100))

        return {
            "status": "ONLINE",
            "last_heartbeat": self.last_heartbeat.isoformat(),
            "approval_mode": settings.APPROVAL_MODE,
            "current_job_id": self.current_job_id,
            "queue_pending_count": pending_count,
            "disk_free_gb": round(free / (1024 ** 3), 2),
            "disk_total_gb": round(total / (1024 ** 3), 2),
            "media_render_dir": settings.MEDIA_RENDER_DIR
        }

    def process_single_job(self, job_id: str) -> Dict[str, Any]:
        """Executes a single job from the queue with compliance and safety checks."""
        self.current_job_id = job_id
        db.update_job_status(job_id, JobStatus.PROCESSING)

        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM publishing_jobs WHERE id = ?", (job_id,))
        job_row = cursor.fetchone()
        conn.close()

        if not job_row:
            return {"success": False, "error": "Job not found"}

        variant = db.get_content_variant(job_row["content_variant_id"])
        product = db.get_product(job_row["product_id"])

        if not variant or not product:
            JobQueue.mark_failed(job_id, "Variant or Product missing from database", retry=False)
            self.current_job_id = None
            return {"success": False, "error": "Entity missing"}

        # 1. Compliance verification
        comp_status, notes = ComplianceEngine.validate(variant)
        if comp_status == ComplianceStatus.BLOCKED:
            JobQueue.mark_failed(job_id, f"Blocked by Compliance Engine: {'; '.join(notes)}", retry=False)
            self.current_job_id = None
            return {"success": False, "error": "Compliance blocked"}

        # 2. Human approval mode enforcement
        mode = settings.APPROVAL_MODE.upper()
        if mode == "MANUAL" and variant.approval_status != ApprovalStatus.APPROVED:
            JobQueue.mark_failed(job_id, "Awaiting manual human approval", retry=False)
            self.current_job_id = None
            return {"success": False, "error": "Awaiting human approval"}

        if mode == "SEMI_AUTOMATIC":
            # Auto-approve if compliance passed and product score >= 70
            if variant.approval_status != ApprovalStatus.APPROVED:
                if product.latest_score >= 70.0 and comp_status == ComplianceStatus.PASSED:
                    db.update_variant_approval(variant.id, ApprovalStatus.APPROVED, "SEMI_AUTO_ENGINE")
                else:
                    JobQueue.mark_failed(job_id, "Semi-auto hold: Score below threshold or compliance warning", retry=False)
                    self.current_job_id = None
                    return {"success": False, "error": "Held for review"}

        # 3. Render video asset if missing
        if not variant.media_path or not os.path.exists(variant.media_path):
            try:
                render_path = VideoEngine.render_short_video(product, variant, duration_sec=3)
                variant.media_path = render_path
                # update in db
                conn = db._get_connection()
                conn.cursor().execute("UPDATE content_variants SET media_path = ? WHERE id = ?", (render_path, variant.id))
                conn.commit()
                conn.close()
            except Exception as e:
                JobQueue.mark_failed(job_id, f"Video render failed: {str(e)}", retry=True)
                self.current_job_id = None
                return {"success": False, "error": str(e)}

        # 4. Dispatch to Publisher
        platform_enum = PlatformType(job_row["platform"])
        publisher = self.publishers.get(platform_enum)

        if not publisher:
            JobQueue.mark_failed(job_id, f"Unsupported publisher platform: {platform_enum}", retry=False)
            self.current_job_id = None
            return {"success": False, "error": "Unsupported platform"}

        job_obj = PublishingJob(**dict(job_row))
        pub_result = publisher.publish(product, variant, job_obj)

        if pub_result.get("success"):
            JobQueue.mark_completed(job_id, pub_result.get("post_id"), pub_result.get("post_url"))
            self.current_job_id = None

            # Seed initial analytics record
            record = AnalyticsRecord(
                id=f"stat_{job_id}",
                job_id=job_id,
                product_id=product.id,
                platform=platform_enum,
                views=0, impressions=0, likes=0, comments=0, shares=0, clicks=0,
                affiliate_clicks=0, affiliate_orders=0, revenue=0.0
            )
            db.record_analytics(record)

            return {"success": True, "post_url": pub_result.get("post_url")}
        else:
            JobQueue.mark_failed(job_id, pub_result.get("error", "Unknown publishing error"), retry=True)
            self.current_job_id = None
            return {"success": False, "error": pub_result.get("error")}

worker = WorkerDaemon()
