# Architecture Specification: AI Affiliate Growth Engine

## 1. System Overview

The **AI Affiliate Growth Engine** is an enterprise-grade, privacy-first, zero-to-low initial cost automation platform designed to discover high-potential products, evaluate profitability, generate compliance-verified original marketing assets (scripts, visuals, vertical short-form videos), orchestrate multi-platform publication through official APIs, and optimize continuous growth through revenue attribution and autonomous feedback loops.

```mermaid
graph TD
    subgraph Data & Discovery Layer
        DISC[Product Discovery Engine]
        TRND[Trend Intelligence Engine]
        PA_API[Amazon PA-API / Seed Catalog]
        RSS[Trend Feeds & Google Trends]
    end

    subgraph Product Intelligence
        SCOR[Multi-Factor Scoring Engine]
        HIST[Historical Price & Score Tracker]
        SEL[Product Selection Filter]
    end

    subgraph Content & Creative Factory
        STRAT[Angle & Hook Strategy Engine]
        COPY[Original Copy & Script Engine]
        MEDIA[Media & Video Engine (FFmpeg/Pillow)]
        TTS[Neural Audio Voiceover Engine]
    end

    subgraph Compliance & Guardrails
        COMP[Content Compliance Filter]
        FTC[FTC Affiliate Disclosure Check]
        COPYR[Copyright & Trademark Check]
        CLAIM[Misleading Claim Checker]
    end

    subgraph Control & Execution
        MODE[Control Mode (Manual / Semi-Auto / Auto)]
        QUEUE[Job & Publishing Queue]
        WORKER[Local Python Worker]
    end

    subgraph Publishing & Channels
        IG[Instagram Graph API]
        FB[Facebook Pages API]
        YT[YouTube Data API v3]
        PIN[Pinterest API v5]
        WEB[GitHub Pages Affiliate Portal]
    end

    subgraph Analytics & Growth Loop
        ANALYTICS[Cross-Platform Analytics Harvester]
        ATTRIB[Revenue Attribution Engine]
        GROWTH[AI Growth Strategist & A/B Engine]
    end

    DISC --> SCOR
    TRND --> SCOR
    PA_API -.-> DISC
    RSS -.-> TRND
    SCOR --> HIST
    SCOR --> SEL
    SEL --> STRAT
    STRAT --> COPY
    STRAT --> MEDIA
    TTS --> MEDIA
    COPY --> COMP
    MEDIA --> COMP
    COMP --> MODE
    MODE --> QUEUE
    QUEUE --> WORKER
    WORKER --> IG
    WORKER --> FB
    WORKER --> YT
    WORKER --> PIN
    WORKER --> WEB
    IG --> ANALYTICS
    FB --> ANALYTICS
    YT --> ANALYTICS
    PIN --> ANALYTICS
    ANALYTICS --> ATTRIB
    ATTRIB --> GROWTH
    GROWTH --> DISC
    GROWTH --> STRAT
```

---

## 2. Architectural Pillars

### 2.1 Zero-to-Low Operating Cost (Bootstrap Phase)
- **Local Compute**: Video rendering via local FFmpeg, Pillow, and local OS TTS or free neural models. No costly cloud GPU instances.
- **Local Storage**: Large MP4 video files, thumbnails, and audio waveforms are stored locally in the worker workspace (`storage/media/`), eliminating high egress and cloud storage fees.
- **Firebase Free Tier (Spark Plan)**:
  - Firestore: Up to 50,000 document reads, 20,000 writes, 20,000 deletes daily, 1 GiB total storage.
  - Authentication: Free phone/email auth up to 50k monthly active users.
  - Database metadata only: Storing lightweight campaign IDs, scores, post IDs, and analytics.

### 2.2 Reusable, Modular Provider Architecture
Every external service (Amazon, Social Platforms, AI LLMs, TTS) is implemented behind a strict abstract interface (`BaseProvider`).
- If Amazon PA-API is not yet accessible (requiring 3 initial sales), the system operates via `CatalogDiscoveryProvider` and `UrlNormalizeProvider` with tag `mybudgetdeal9-21`.
- When PA-API credentials become available, zero downstream code changes are required—only an environment flag `DISCOVERY_PROVIDER=amazon_paapi`.

### 2.3 Strict Copyright & Compliance Guardrails
- Under no circumstance does the system rip, scrape, or republish creator videos, copyrighted music, or scraped competitor assets.
- Marketing assets are procedurally composited using licensed templates, programmatically generated graphics, clear typography, and open audio assets.
- Every piece of generated copy passes through an automated FTC disclosure verification (`#ad`, `#sponsored`, or explicit affiliate disclaimer) prior to queuing.

---

## 3. Component Details

### 3.1 Backend & API Service (FastAPI)
- **Language**: Python 3.14+
- **Framework**: FastAPI (asynchronous ASGI, high throughput)
- **Responsibilities**:
  - RESTful endpoints for Product Discovery, Scoring, Content Generation, Campaign Management, and Analytics.
  - WebSocket / SSE feeds for real-time Worker telemetry (CPU, Memory, Current Render Job, Queue status).
  - Webhook ingestion endpoints for Social Platform callback events.

### 3.2 Local Worker Process
- **Architecture**: Decoupled background service running locally on Windows/Linux.
- **Queue System**: SQLite / File-backed robust persistent queue with Firestore sync.
- **Job Lifecycle**: `PENDING` -> `PROCESSING` -> `COMPLETED` | `FAILED` -> `RETRYING` (exponential backoff with jitter).
- **Idempotency**: Hash-based duplicate detection ensures no piece of content can ever be published twice due to retries or network blips.

### 3.3 Modern Web Dashboard
- **Frontend Stack**: React 18+ with Vite, Tailwind/Vanilla CSS modern glassmorphism UI.
- **Real-time Status**: Live worker heartbeat, CPU/memory gauges, interactive approval queue with video preview, campaign calendar, and ROI analytics.
