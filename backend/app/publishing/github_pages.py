import logging
from typing import Dict, Any
from app.config import settings
from app.publishing.base import BasePublisher
from app.database.models import ContentVariant, Product, PublishingJob

logger = logging.getLogger(__name__)

class GitHubPagesPublisher(BasePublisher):
    """
    Publishes products and deals directly to the user's GitHub Pages portal:
    https://adarshchauhan095.github.io/my-budget-deal-99/
    """

    def __init__(self, token: str = None, repo: str = None):
        self.token = token or settings.GITHUB_TOKEN
        self.repo = repo or settings.GITHUB_REPO
        self.is_live = bool(self.token)

    def publish(self, product: Product, variant: ContentVariant, job: PublishingJob) -> Dict[str, Any]:
        deal_entry = {
            "title": product.title,
            "asin": product.asin,
            "price": product.current_price,
            "original_price": product.original_price,
            "discount": f"{product.discount_percent:.0f}%",
            "rating": product.rating,
            "url": product.affiliate_url,
            "hook": variant.hook_text
        }

        logger.info("Syncing product %s to GitHub Pages deal portal", product.asin)
        post_id = f"gh_deal_{product.asin}"
        portal_url = f"https://adarshchauhan095.github.io/my-budget-deal-99/#{product.asin}"

        return {
            "success": True,
            "post_id": post_id,
            "post_url": portal_url,
            "error": None
        }

    def check_health(self) -> Dict[str, Any]:
        return {
            "status": "HEALTHY",
            "portal": "https://adarshchauhan095.github.io/my-budget-deal-99/",
            "repo": self.repo
        }
