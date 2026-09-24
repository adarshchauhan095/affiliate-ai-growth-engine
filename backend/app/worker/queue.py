import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from app.database.db import db
from app.database.models import PublishingJob, JobStatus, PlatformType

class JobQueue:
    """
    Persistent job queue with SHA-256 idempotency and duplicate protection.
    """

    @staticmethod
    def generate_idempotency_key(platform: PlatformType, variant_id: str, scheduled_time: datetime) -> str:
        date_str = scheduled_time.strftime("%Y-%m-%d")
        raw = f"{platform.value}_{variant_id}_{date_str}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    def schedule_job(
        cls,
        variant_id: str,
        product_id: str,
        platform: PlatformType,
        scheduled_time: Optional[datetime] = None
    ) -> PublishingJob:
        if not scheduled_time:
            scheduled_time = datetime.now(timezone.utc)

        idempotency_key = cls.generate_idempotency_key(platform, variant_id, scheduled_time)

        # Check existing jobs to prevent duplicate posts
        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM publishing_jobs WHERE idempotency_key = ?", (idempotency_key,))
        existing = cursor.fetchone()
        conn.close()

        if existing:
            return PublishingJob(**dict(existing))

        job = PublishingJob(
            id=f"job_{uuid.uuid4().hex[:10]}",
            content_variant_id=variant_id,
            product_id=product_id,
            platform=platform,
            scheduled_time=scheduled_time,
            status=JobStatus.PENDING,
            attempt_count=0,
            max_attempts=3,
            idempotency_key=idempotency_key
        )
        db.add_publishing_job(job)
        return job

    @classmethod
    def get_next_jobs(cls, limit: int = 10) -> List[PublishingJob]:
        return db.list_pending_jobs()[:limit]

    @classmethod
    def mark_completed(cls, job_id: str, post_id: str, post_url: str):
        db.update_job_status(job_id, JobStatus.PUBLISHED, platform_post_id=post_id, platform_post_url=post_url)

    @classmethod
    def mark_failed(cls, job_id: str, error: str, retry: bool = True):
        conn = db._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT attempt_count, max_attempts FROM publishing_jobs WHERE id = ?", (job_id,))
        row = cursor.fetchone()
        conn.close()

        if row and retry and row["attempt_count"] < row["max_attempts"]:
            new_attempts = row["attempt_count"] + 1
            # Exponential backoff: retry in 2 ** attempts minutes
            next_time = (datetime.now(timezone.utc) + timedelta(minutes=2 ** new_attempts)).isoformat()
            conn = db._get_connection()
            conn.cursor().execute("""
                UPDATE publishing_jobs
                SET attempt_count = ?, scheduled_time = ?, status = 'PENDING', error_message = ?
                WHERE id = ?
            """, (new_attempts, next_time, error, job_id))
            conn.commit()
            conn.close()
        else:
            db.update_job_status(job_id, JobStatus.FAILED, error_message=error)
