import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["associate_tag"] == "mybudgetdeal9-21"
    assert "telemetry" in data

def test_frontend_root():
    res = client.get("/")
    assert res.status_code == 200
    assert "AI Affiliate Growth Engine" in res.text

def test_product_discovery_and_listing():
    res = client.get("/api/products")
    assert res.status_code == 200
    products = res.json()
    assert len(products) > 0
    p = products[0]
    assert "mybudgetdeal9-21" in p["affiliate_url"]
    assert p["latest_score"] > 0

def test_url_import():
    payload = {
        "url_or_asin": "https://www.amazon.in/dp/B07XYZ9999/ref=deal",
        "category": "Gadgets"
    }
    res = client.post("/api/products/import-url", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["product"]["asin"] == "B07XYZ9999"
    assert "tag=mybudgetdeal9-21" in data["product"]["affiliate_url"]

def test_content_generation_and_approval():
    prods_res = client.get("/api/products")
    product_id = prods_res.json()[0]["id"]

    gen_res = client.post(f"/api/products/{product_id}/generate-content")
    assert gen_res.status_code == 200
    variants = gen_res.json()["variants"]
    assert len(variants) >= 4

    var_id = variants[0]["id"]
    appr_res = client.post(f"/api/variants/{var_id}/approval", json={"action": "APPROVE"})
    assert appr_res.status_code == 200
    assert appr_res.json()["approval_status"] == "APPROVED"

def test_job_scheduling_and_worker_pipeline():
    prods_res = client.get("/api/products")
    product_id = prods_res.json()[0]["id"]

    # Generate fresh variant
    gen_res = client.post(f"/api/products/{product_id}/generate-content")
    var_id = gen_res.json()["variants"][0]["id"]

    # Ensure approved
    client.post(f"/api/variants/{var_id}/approval", json={"action": "APPROVE"})

    # Schedule publishing to YouTube
    sched_payload = {
        "variant_id": var_id,
        "product_id": product_id,
        "platform": "YOUTUBE"
    }
    sched_res = client.post("/api/jobs/schedule", json=sched_payload)
    assert sched_res.status_code == 200
    job = sched_res.json()["job"]
    assert job["platform"] == "YOUTUBE"

    # Worker processes the job
    proc_res = client.post("/api/worker/process-next")
    assert proc_res.status_code == 200
    proc_data = proc_res.json()
    assert proc_data["result"]["success"] is True

def test_analytics_and_growth_loop():
    summary_res = client.get("/api/analytics/summary")
    assert summary_res.status_code == 200

    eval_res = client.post("/api/growth/evaluate")
    assert eval_res.status_code == 200
    assert "generated_strategies_count" in eval_res.json()
