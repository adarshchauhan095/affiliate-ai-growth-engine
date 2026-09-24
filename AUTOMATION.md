# Automation & Worker Architecture

## 1. Automation Pipeline

```mermaid
sequenceDiagram
    participant UI as Dashboard / API
    participant DB as SQLite / Firestore
    participant Q as Job Queue
    participant W as Local Worker Daemon
    participant FF as FFmpeg Engine
    participant PUB as Official Platform APIs

    UI->>DB: Ingest Product (Seed or URL)
    UI->>DB: Generate Creative Variants
    UI->>Q: Schedule Job (Variant + Platform)
    Note over Q: Generates SHA-256 Idempotency Key
    W->>Q: Poll Pending Jobs
    Q-->>W: Return Job
    W->>W: Run 7-Stage Compliance Check
    alt If Media Missing
        W->>FF: Render Vertical 9:16 Short Video
        FF-->>W: Save to storage/media/renders/*.mp4
    end
    W->>PUB: Dispatch to Official API (YouTube / IG / GH Pages)
    PUB-->>W: Return Post ID & Permalink
    W->>DB: Mark PUBLISHED & Seed Analytics Record
```

---

## 2. Modes of Operation

1. **`MANUAL`**:
   - Every piece of generated content requires explicit human confirmation via the web dashboard before scheduling or publishing.
2. **`SEMI_AUTOMATIC` (Default)**:
   - High-confidence products (Score >= 70) with 100% passed compliance validation are automatically approved.
   - Any variant triggering a warning or having lower confidence is held for review.
3. **`AUTONOMOUS`**:
   - End-to-end autonomous discovery, scoring, video creation, scheduling, and strategic optimization loop.
