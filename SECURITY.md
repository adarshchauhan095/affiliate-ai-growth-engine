# Security Architecture & Credential Management

## 1. Zero Trust Principles

### 1.1 Credential Isolation
No secrets, API keys, OAuth tokens, or passwords may exist in:
- Git repositories (enforced via strict `.gitignore`)
- Client-side frontend bundles (Vite/React)
- Public URLs or query strings
- Log files or error traces (sanitized via custom logger filter)

### 1.2 User Credential Warning & Immediate Remediation
> [!CAUTION]
> **Immediate Action Required**: Do not transmit raw Amazon passwords or personal account passwords in chat prompts or configuration files. If an account password was previously shared, update it immediately in Amazon Security Settings. All integrations must strictly utilize scoped API tokens, App Passwords, or OAuth keys stored in local `.env` files.

### 1.3 Secret Hierarchy
1. `.env` (Never checked into source control; modeled after `.env.example`).
2. Local OS Credential Vault / Encrypted Keyring (for OAuth refresh tokens).
3. Firebase Admin Service Account JSON (stored exclusively on local worker, excluded from repo).

---

## 2. API Key & Token Lifecycle

| Secret Name | Intended Usage | Storage Location | Exposure Risk |
| :--- | :--- | :--- | :--- |
| `AMAZON_ASSOCIATE_TAG` | Affiliate link generation | `.env` / DB (Public in links) | Low (Public identifier) |
| `AMAZON_PAAPI_KEY` | Product Advertising API access | `.env` (Worker only) | Critical (Server-side only) |
| `AMAZON_PAAPI_SECRET` | Product Advertising API HMAC | `.env` (Worker only) | Critical (Server-side only) |
| `FIREBASE_ADMIN_CREDENTIALS` | Local worker Firestore sync | Local filesystem path in `.env` | Critical (Never in Git) |
| `INSTAGRAM_ACCESS_TOKEN` | Meta Graph API publishing | Encrypted worker store | High (Scoped token) |
| `YOUTUBE_OAUTH_CLIENT_SECRET`| YouTube Data API v3 upload | Local secure config | High (Rotate on compromise) |
| `PINTEREST_ACCESS_TOKEN` | Pinterest API v5 Pin creation | Local secure config | High (Scoped token) |

---

## 3. Worker Security & Local Sandboxing
- Rendered video outputs are constrained strictly within `storage/media/` using normalized absolute paths to prevent path-traversal attacks (`os.path.commonpath` checks).
- Subprocess invocations (FFmpeg) use sanitized argument lists rather than raw shell strings (`shell=False`) to preclude command injection.
- API endpoints require local bearer tokens or Firebase Auth JWT tokens.
