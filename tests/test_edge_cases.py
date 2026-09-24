import sys
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi.testclient import TestClient
from app.api.main import app
from app.discovery.url_normalizer import extract_asin
from app.compliance.compliance_engine import ComplianceEngine
from app.database.models import ContentVariant, ContentAngle, ComplianceStatus, PlatformType
from app.worker.queue import JobQueue
from app.worker.worker_daemon import worker

client = TestClient(app)

def test_edge_case_malformed_amazon_urls():
    assert extract_asin("https://google.com") is None
    assert extract_asin("not_a_valid_url") is None
    assert extract_asin("https://amazon.in/bad/path/") is None
    assert extract_asin("B0BT9CXXXX") == "B0BT9CXXXX"

def test_edge_case_invalid_url_import_api():
    res = client.post("/api/products/import-url", json={"url_or_asin": "invalid_url_without_asin"})
    assert res.status_code == 400
    assert "Could not extract valid" in res.json()["detail"]

def test_edge_case_compliance_blocks_misleading_claims():
    bad_variant = ContentVariant(
        id=f"var_{uuid.uuid4().hex[:10]}",
        product_id="prod_test",
        angle_type=ContentAngle.PROBLEM_SOLUTION,
        hook_text="Secret amazon glitch gives 100% free money and guaranteed to cure all ailments!",
        body_script="Buy now for instant wealth.",
        cta_text="Click link",
        disclosure_text="As an Amazon Associate I earn from qualifying purchases #ad",
        hashtags=["#ad"]
    )
    status, notes = ComplianceEngine.validate(bad_variant)
    assert status == ComplianceStatus.BLOCKED
    assert any("misleading or unauthorized" in n.lower() for n in notes)

def test_edge_case_compliance_blocks_missing_ftc():
    no_ftc_variant = ContentVariant(
        id=f"var_{uuid.uuid4().hex[:10]}",
        product_id="prod_test",
        angle_type=ContentAngle.PROBLEM_SOLUTION,
        hook_text="Great deal on headphones today!",
        body_script="Sound quality is incredible for the price.",
        cta_text="Check bio",
        disclosure_text="",  # No disclosure
        hashtags=["#deal", "#headphones"]
    )
    status, notes = ComplianceEngine.validate(no_ftc_variant)
    assert status == ComplianceStatus.BLOCKED
    assert any("FTC" in n for n in notes)

def test_edge_case_duplicate_job_idempotency():
    variant_id = f"var_dup_{uuid.uuid4().hex[:8]}"
    product_id = "prod_dup_123"

    job1 = JobQueue.schedule_job(variant_id, product_id, PlatformType.YOUTUBE)
    job2 = JobQueue.schedule_job(variant_id, product_id, PlatformType.YOUTUBE)

    # Must return exact same job instance, preventing duplicate queueing/posting
    assert job1.id == job2.id
    assert job1.idempotency_key == job2.idempotency_key

def test_edge_case_worker_handles_nonexistent_job():
    res = worker.process_single_job("job_does_not_exist_99999")
    assert res["success"] is False
    assert "Job not found" in res["error"]
