# Troubleshooting Guide

### 1. `ffmpeg` command not found
- Ensure FFmpeg is installed and added to your system environment `PATH`.
- In PowerShell, run `Get-Command ffmpeg` to verify.

### 2. Job fails with "Awaiting manual human approval"
- System is running in `MANUAL` approval mode.
- Go to the **Approval Queue** tab in the dashboard and click **Approve** on the variant.
- Alternatively, set `APPROVAL_MODE=SEMI_AUTOMATIC` in `.env`.

### 3. Amazon PA-API "Access Denied" or Invalid Signature
- Amazon PA-API requires **3 qualifying sales within 180 days** before API credentials activate.
- Keep `DISCOVERY_PROVIDER=seed_catalog` or import products via URL in the dashboard until your first 3 sales are confirmed in the Amazon Associates central dashboard.

### 4. Video generation output size is 0 bytes
- Verify that `storage/media/temp` and `storage/media/renders` directories are writeable.
- Ensure audio codecs (`aac` or `pcm_s16le`) are supported by your local FFmpeg build.
