from abc import ABC, abstractmethod
from typing import List, Optional
from app.database.models import Product

class ProductDiscoveryProvider(ABC):
    """
    Abstract interface for product discovery.
    Allows zero-code switching between Seed Catalog, Manual/RSS Importers,
    and official Amazon PA-API 5.0 once 3 qualifying sales are achieved.
    """

    @abstractmethod
    def search_products(self, query: str, category: Optional[str] = None, limit: int = 10) -> List[Product]:
        """Search products matching a query or category."""
        pass

    @abstractmethod
    def get_trending_products(self, category: Optional[str] = None, limit: int = 10) -> List[Product]:
        """Fetch current trending/high-velocity products."""
        pass

    @abstractmethod
    def get_product_by_asin(self, asin: str) -> Optional[Product]:
        """Fetch full product details by ASIN."""
        pass
