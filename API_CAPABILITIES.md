# Platform API Capability & Integration Matrix

## 1. Overview Matrix

| Platform | Official API Available | Automated Publishing | Analytics Retrieval | Auth Mechanism | Rate / Quota Limits | Pre-Sale Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Amazon Associates (PA-API 5.0)** | Yes (Restricted) | N/A (Product Catalog) | Daily Reports (Portal) | AWS Signature v4 | 1 req/sec initial (needs 3 sales) | **Gated by 3 Sales** (Simulated / Seed Catalog used) |
| **Instagram** | Meta Graph API | Reels, Carousel, Single Photo | Impressions, Reach, Plays, Saves | OAuth 2.0 / User/Page Token | 25 API-published posts / 24 hrs | Ready for Token |
| **Facebook Pages** | Meta Graph API | Video, Reels, Posts | Page Insights, Video Views | Page Access Token | Standard Graph API Rate Limits | Ready for Token |
| **YouTube** | YouTube Data API v3 | Shorts, Long-form Video | YouTube Analytics API | OAuth 2.0 Client ID | 10,000 units/day (video upload = ~1600 units) | Ready for OAuth |
| **Pinterest** | Pinterest API v5 | Standard & Video Pins | Pin Impressions, Clicks, Saves | OAuth 2.0 / Access Token | 1000 requests/hour | Ready for OAuth |
| **GitHub Pages** | GitHub REST API | Markdown / Static Catalog | Repo Traffic / Page Views | GitHub Personal Access Token (PAT) | 5,000 requests/hour | **Active & Ready** |

---

## 2. Special Pre-PA-API Strategy (The "3 Sales" Bootstrap Pathway)

### 2.1 The Challenge
Amazon PA-API 5.0 explicitly requires **3 qualifying sales within the first 180 days** of creating an Associate account before granting active PA-API access keys.

### 2.2 The Solution: Dual-Mode Architecture
The system employs the **Provider Pattern** via `ProductDiscoveryProvider`:
1. **`SeedCatalogProvider` (Active during Bootstrap)**:
   - Ingests products via user-curated ASIN lists, Amazon Best Sellers / Movers & Shakers RSS feeds, or manual URL drops.
   - Automatically canonicalizes links and injects the user's affiliate tag `mybudgetdeal9-21`:
     `https://www.amazon.in/dp/{ASIN}?tag=mybudgetdeal9-21`
   - Formats product showcase cards directly committed to the user's GitHub Pages portal (`https://adarshchauhan095.github.io/my-budget-deal-99/`).
2. **`AmazonPaApiProvider` (Pluggable on qualification)**:
   - Implements identical methods: `search_items()`, `get_variations()`, `get_item_details()`.
   - Activated instantly when the 3 sales occur by switching `DISCOVERY_MODE=paapi` in `.env`.

---

## 3. Supported Channel Profiles
- **Instagram**: `mybudgetdeal99`
- **YouTube**: `@mybudgetdeal99`
- **Associate Tag**: `mybudgetdeal9-21`
- **Catalog Web Landing**: `https://adarshchauhan095.github.io/my-budget-deal-99/`
