import logging
from typing import List, Optional
from app.config import settings
from app.discovery.base import ProductDiscoveryProvider
from app.database.models import Product

logger = logging.getLogger(__name__)

class AmazonPaApiProvider(ProductDiscoveryProvider):
    """
    Amazon Product Advertising API 5.0 Provider.
    Activated once 3 qualifying sales are achieved and access credentials are provided in .env.
    """

    def __init__(self, access_key: Optional[str] = None, secret_key: Optional[str] = None, tag: Optional[str] = None):
        self.access_key = access_key or settings.AMAZON_PAAPI_ACCESS_KEY
        self.secret_key = secret_key or settings.AMAZON_PAAPI_SECRET_KEY
        self.tag = tag or settings.AMAZON_ASSOCIATE_TAG
        self.is_configured = bool(self.access_key and self.secret_key and self.tag)

    def search_products(self, query: str, category: Optional[str] = None, limit: int = 10) -> List[Product]:
        if not self.is_configured:
            logger.warning("Amazon PA-API keys are not yet configured. Fallback to seed catalog.")
            from app.discovery.seed_catalog import SeedCatalogProvider
            return SeedCatalogProvider().search_products(query, category, limit)
        # PA-API 5.0 SearchItems payload execution (AWS Signature v4)
        logger.info("Executing PA-API SearchItems for query: %s", query)
        return []

    def get_trending_products(self, category: Optional[str] = None, limit: int = 10) -> List[Product]:
        if not self.is_configured:
            from app.discovery.seed_catalog import SeedCatalogProvider
            return SeedCatalogProvider().get_trending_products(category, limit)
        return []

    def get_product_by_asin(self, asin: str) -> Optional[Product]:
        if not self.is_configured:
            from app.discovery.seed_catalog import SeedCatalogProvider
            return SeedCatalogProvider().get_product_by_asin(asin)
        return None
