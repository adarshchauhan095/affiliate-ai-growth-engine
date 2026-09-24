# REST API Reference Documentation

Base URL: `http://127.0.0.1:8000`

---

## 1. System & Health

### `GET /api/health`
Returns live system health, Associate Tag, Approval Mode, and Worker hardware telemetry.
**Response**:
```json
{
  "status": "HEALTHY",
  "app": "AI Affiliate Growth Engine",
  "env": "development",
  "associate_tag": "mybudgetdeal9-21",
  "approval_mode": "SEMI_AUTOMATIC",
  "telemetry": {
    "status": "ONLINE",
    "last_heartbeat": "2026-09-24T16:09:47.382436+00:00",
    "queue_pending_count": 0,
    "disk_free_gb": 128.4
  }
}
```

---

## 2. Product Discovery & Ingestion

### `GET /api/products`
Lists scored products ordered by overall score. Auto-seeds default deals if empty.

### `POST /api/products/discover`
Trigger trend search by keyword or category.
- Query parameters: `query` (optional string), `category` (optional string)

### `POST /api/products/import-url`
Ingests an Amazon product URL or raw ASIN. Normalizes link, embeds affiliate tag `mybudgetdeal9-21`, and scores immediately.
**Payload**:
```json
{
  "url_or_asin": "https://www.amazon.in/dp/B08XYZ1111",
  "category": "Audio"
}
```

---

## 3. Creative Strategy & Content

### `POST /api/products/{id}/generate-content`
Generates 4 distinct creative angles (`PROBLEM_SOLUTION`, `TOP_3_BENEFITS`, `PRICE_DROP`, `MISTAKE_TO_AVOID`), scroll-stopping hooks, scripts, CTAs, FTC disclosures, and hashtags.

### `GET /api/variants`
Lists generated variants with compliance statuses (`PASSED`, `WARN`, `BLOCKED`).

### `POST /api/variants/{id}/approval`
Manual approval or rejection of a creative variant.
**Payload**:
```json
{
  "action": "APPROVE",
  "approved_by": "HUMAN_OPERATOR"
}
```

---

## 4. Publishing & Worker Queue

### `POST /api/jobs/schedule`
Enqueues a publishing job with duplicate-protection SHA-256 idempotency key.
**Payload**:
```json
{
  "variant_id": "var_123456",
  "product_id": "prod_B08XYZ1111",
  "platform": "YOUTUBE"
}
```

### `GET /api/jobs`
Lists pending and scheduled publishing jobs.

### `POST /api/worker/process-next`
Dispatches the local worker to process the next job in queue (renders FFmpeg video if missing, checks compliance, calls official publisher).

---

## 5. Analytics & AI Growth Strategist

### `GET /api/analytics/summary`
Returns total views, clicks, affiliate clicks, attributed orders, revenue, and channel breakdowns.

### `POST /api/growth/evaluate`
Triggers AI strategic analysis cycle, identifying conversion anomalies and proposing optimization actions.

### `GET /api/growth/strategies`
Lists generated growth recommendations.
