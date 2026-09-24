# AI Affiliate Growth Engine - Setup & Quickstart Guide

## Prerequisites
- **Python**: 3.10+ (Verified on Python 3.14)
- **FFmpeg**: 5.0+ (Installed and on system `PATH`)
- **OS**: Windows, macOS, or Linux

---

## 1. Installation

1. **Clone repository**:
   ```bash
   git clone git@github.com:adarshchauhan095/affiliate-ai-growth-engine.git
   cd affiliate-ai-growth-engine
   ```

2. **Install Python dependencies**:
   ```bash
   python -m pip install -r requirements.txt
   ```

3. **Verify FFmpeg installation**:
   ```bash
   ffmpeg -version
   ```

---

## 2. Configuration

Copy the example environment template:
```bash
cp .env.example .env
```

Your pre-configured associate tag is:
```ini
AMAZON_ASSOCIATE_TAG=mybudgetdeal9-21
AMAZON_MARKETPLACE=IN
APPROVAL_MODE=SEMI_AUTOMATIC
```

> [!NOTE]
> **Pre-PA-API Testing**: Amazon PA-API 5.0 keys are left blank until you achieve 3 qualifying sales with your affiliate tag. The built-in seed catalog and URL normalizer will operate immediately at zero cost.

---

## 3. Running the Engine

Start the local server & web dashboard:
```bash
python -m uvicorn app.api.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

Open your browser at:
👉 **`http://127.0.0.1:8000/`**

---

## 4. Running the Automated Test Suite

Execute the full 18-test automated suite (Unit, Integration, Media/FFmpeg, Edge Cases):
```bash
python -m pytest tests/ -v
```
