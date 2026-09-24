import logging
import httpx
from typing import Dict, Any
from app.config import settings
from app.publishing.base import BasePublisher
from app.database.models import ContentVariant, Product, PublishingJob

logger = logging.getLogger(__name__)

class InstagramPublisher(BasePublisher):
    """
    Official Meta Graph API Publisher for Instagram Reels / Video posts.
    Account: mybudgetdeal99
    """

    def __init__(self, account_id: str = None, access_token: str = None):
        self.account_id = account_id or settings.INSTAGRAM_ACCOUNT_ID
        self.access_token = access_token or settings.INSTAGRAM_ACCESS_TOKEN
        self.is_live = bool(self.account_id and self.access_token)

    def publish(self, product: Product, variant: ContentVariant, job: PublishingJob) -> Dict[str, Any]:
        caption = f"{variant.hook_text}\n\n{variant.body_script}\n\n{variant.cta_text}\n\n{variant.disclosure_text}\n\n{' '.join(variant.hashtags)}"

        if not self.is_live:
            logger.info("[Instagram Sandbox] Simulating official Graph API Reel upload for product %s", product.asin)
            simulated_id = f"ig_sim_{job.id}"
            return {
                "success": True,
                "post_id": simulated_id,
                "post_url": f"https://www.instagram.com/mybudgetdeal99/reel/{simulated_id}/",
                "error": None
            }

        try:
            # 1. Create Media Container
            container_url = f"https://graph.facebook.com/v20.0/{self.account_id}/media"
            container_payload = {
                "caption": caption,
                "access_token": self.access_token,
                "media_type": "REELS",
                # Note: Meta Graph API requires public video_url for media upload
                "video_url": variant.media_path
            }
            res = httpx.post(container_url, data=container_payload, timeout=30.0)
            res_data = res.json()
            if "error" in res_data:
                return {"success": False, "post_id": None, "post_url": None, "error": res_data["error"].get("message")}

            container_id = res_data["id"]

            # 2. Publish Media Container
            publish_url = f"https://graph.facebook.com/v20.0/{self.account_id}/media_publish"
            pub_res = httpx.post(publish_url, data={"creation_id": container_id, "access_token": self.access_token}, timeout=30.0)
            pub_data = pub_res.json()

            if "error" in pub_data:
                return {"success": False, "post_id": None, "post_url": None, "error": pub_data["error"].get("message")}

            post_id = pub_data["id"]
            return {
                "success": True,
                "post_id": post_id,
                "post_url": f"https://www.instagram.com/p/{post_id}/",
                "error": None
            }
        except Exception as e:
            logger.error("Instagram publish failed: %s", str(e))
            return {"success": False, "post_id": None, "post_url": None, "error": str(e)}

    def check_health(self) -> Dict[str, Any]:
        if not self.is_live:
            return {"status": "SANDBOX_MOCK", "message": "Tokens not configured; operating in simulation sandbox mode."}
        try:
            url = f"https://graph.facebook.com/v20.0/{self.account_id}?fields=username&access_token={self.access_token}"
            res = httpx.get(url, timeout=10.0)
            data = res.json()
            if "error" in data:
                return {"status": "ERROR", "message": data["error"].get("message")}
            return {"status": "HEALTHY", "username": data.get("username")}
        except Exception as ex:
            return {"status": "UNREACHABLE", "message": str(ex)}
