# Cost Audit & Economic Blueprint

## 1. Zero-Cost MVP Baseline (Current Architecture)

The system is engineered to operate at **₹0 / $0 monthly software infrastructure cost** during the bootstrap phase:

| Component | Technology | Cost | Limitation / Free Tier Quota |
| :--- | :--- | :--- | :--- |
| **Compute / Video Rendering** | Local FFmpeg 9.0 + Pillow | **₹0.00** | Bound by local CPU/GPU (Unlimited) |
| **Media Storage** | Local Disk (`storage/media/`) | **₹0.00** | Bound by local hard drive capacity |
| **Database** | Local SQLite (`storage/data/`) | **₹0.00** | Millions of rows without fees |
| **Cloud DB Fallback** | Firebase Spark Plan (Free) | **₹0.00** | 50k reads, 20k writes, 1 GB storage daily |
| **Web Deal Portal** | GitHub Pages | **₹0.00** | 100 GB bandwidth / month, 1 GB repo size |
| **Social Publishing APIs** | Official Meta & YouTube APIs | **₹0.00** | Free within standard developer quotas |
| **Total Bootstrap Cost** | | **₹0.00** | **100% Free** |

---

## 2. Platform Quotas & Rate Limits

1. **YouTube Data API v3**:
   - 10,000 quota units / day.
   - Video upload: ~1,600 units.
   - Max uploads: **~6 Short videos per day** without quota increase.
2. **Instagram Graph API**:
   - 25 API-published posts per Instagram account within any 24-hour rolling window.
3. **Amazon PA-API 5.0**:
   - Gated behind 3 qualifying sales within 180 days.
   - Once qualified: 1 request per second baseline (86,400 requests/day).

---

## 3. Scale-Up Cost Projections (Post-Monetization)

When affiliate revenues scale past ₹50,000 / month and multi-node cloud workers are introduced:
- **Cloud Object Storage (AWS S3 or Cloudflare R2)**: ~$0.015 / GB-month (Zero egress fees on Cloudflare R2).
- **Managed PostgreSQL / Firestore Blaze**: ~$5 to $15 / month when exceeding 50,000 daily active reads.
- **Dedicated Cloud GPU Renderer (Modal / RunPod)**: ~$0.20 / render hour (only needed if rendering 100+ videos daily in cloud).
