from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from app.database.models import ContentVariant, Product, PublishingJob

class BasePublisher(ABC):
    """
    Abstract interface for platform publishers.
    Enforces standardized publishing contracts, error handling,
    and telemetry across Instagram, YouTube, Facebook, Pinterest, and Web Portal.
    """

    @abstractmethod
    def publish(self, product: Product, variant: ContentVariant, job: PublishingJob) -> Dict[str, Any]:
        """
        Execute publication through official API.
        Returns dict with:
        - success: bool
        - post_id: Optional[str]
        - post_url: Optional[str]
        - error: Optional[str]
        """
        pass

    @abstractmethod
    def check_health(self) -> Dict[str, Any]:
        """Verify token validity, quota remaining, and connection status."""
        pass
