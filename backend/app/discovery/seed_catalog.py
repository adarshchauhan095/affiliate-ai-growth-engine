import uuid
from typing import List, Optional
from datetime import datetime, timezone
from app.config import settings
from app.discovery.base import ProductDiscoveryProvider
from app.discovery.url_normalizer import build_affiliate_url
from app.database.models import Product, AvailabilityStatus, DiscoverySource

# Curated High-Velocity Seed Catalog targeting Indian Marketplace & Budget Deals
SEED_PRODUCTS = [
    {
        "asin": "B0BT9CXXXX",
        "title": "Portronics Konnect L 1.2M Fast Charging Type C to 8 Pin USB Cable with 3A Output",
        "category": "Electronics & Mobile Accessories",
        "original_price": 499.0,
        "current_price": 199.0,
        "currency": "INR",
        "rating": 4.2,
        "review_count": 14200,
        "features": [
            "Tangle-free 1.2m nylon braided cable",
            "Fast PD charging support up to 3A",
            "Durable reinforced connector joints",
            "Universal compatibility with modern devices"
        ],
        "image_urls": ["https://images-eu.ssl-images-amazon.com/images/I/sample_cable.jpg"]
    },
    {
        "asin": "B09X7YYYYY",
        "title": "Noise Pulse 2 Max 1.85'' Display Bluetooth Calling Smartwatch with 550 Nits Brightness",
        "category": "Smartwatches & Wearables",
        "original_price": 5999.0,
        "current_price": 1299.0,
        "currency": "INR",
        "rating": 4.1,
        "review_count": 89400,
        "features": [
            "Massive 1.85 inch bright TFT LCD",
            "Clear Bluetooth calling with Tru Sync",
            "100 sports modes & IP68 water resistance",
            "10-day battery life on single charge"
        ],
        "image_urls": ["https://images-eu.ssl-images-amazon.com/images/I/sample_watch.jpg"]
    },
    {
        "asin": "B08Z8ZZZZZ",
        "title": "Pigeon by Stovekraft Handy Mini Plastic Chopper with 3 Blades for Quick Vegetable Cutting",
        "category": "Home & Kitchen",
        "original_price": 495.0,
        "current_price": 249.0,
        "currency": "INR",
        "rating": 4.4,
        "review_count": 210000,
        "features": [
            "Sturdy 3-blade design made from stainless steel",
            "Unique string pull operation for effortless chopping",
            "Food-grade BPA free unbreakable plastic",
            "Compact and easy to clean"
        ],
        "image_urls": ["https://images-eu.ssl-images-amazon.com/images/I/sample_chopper.jpg"]
    },
    {
        "asin": "B08XYZ1111",
        "title": "boAt Bassheads 100 in-Ear Wired Headphones with Mic and Hawk Inspired Design",
        "category": "Audio & Electronics",
        "original_price": 999.0,
        "current_price": 349.0,
        "currency": "INR",
        "rating": 4.1,
        "review_count": 380000,
        "features": [
            "10mm dynamic drivers for super extra bass",
            "In-line microphone with hands-free calling",
            "Hawk inspired ergonomic earbuds",
            "Durable 1.2m tangle-resistant cable"
        ],
        "image_urls": ["https://images-eu.ssl-images-amazon.com/images/I/sample_earphones.jpg"]
    },
    {
        "asin": "B0B8K22222",
        "title": "Wipro 16A Wi-Fi Smart Plug with Energy Monitoring and Voice Control",
        "category": "Smart Home & Gadgets",
        "original_price": 1990.0,
        "current_price": 849.0,
        "currency": "INR",
        "rating": 4.2,
        "review_count": 32500,
        "features": [
            "Control AC, geysers, or heaters from anywhere",
            "Energy consumption tracking to cut electricity bills",
            "Voice control with Alexa and Google Assistant",
            "No hub required, connects directly to home Wi-Fi"
        ],
        "image_urls": ["https://images-eu.ssl-images-amazon.com/images/I/sample_smartplug.jpg"]
    },
    {
        "asin": "B09PQ33333",
        "title": "Tygot Gorilla Tripod 13 Inch Flexible Mini Tripod with Mobile Phone Holder and Remote",
        "category": "Photography & Content Creation",
        "original_price": 1299.0,
        "current_price": 399.0,
        "currency": "INR",
        "rating": 4.0,
        "review_count": 48200,
        "features": [
            "Flexible wrap-around legs for gripping any pole or fence",
            "360-degree rotating ball head for vertical shorts/reels",
            "Heavy-duty build supporting smartphones and DSLRs",
            "Includes universal phone clip and bluetooth shutter"
        ],
        "image_urls": ["https://images-eu.ssl-images-amazon.com/images/I/sample_tripod.jpg"]
    }
]

class SeedCatalogProvider(ProductDiscoveryProvider):
    """Seed catalog provider allowing zero-cost instant bootstrap and testing."""

    def __init__(self, tag: Optional[str] = None, marketplace: Optional[str] = None):
        self.tag = tag or settings.AMAZON_ASSOCIATE_TAG
        self.marketplace = marketplace or settings.AMAZON_MARKETPLACE

    def _to_product(self, raw: dict) -> Product:
        affiliate_url, canonical_url = build_affiliate_url(
            asin=raw["asin"],
            tag=self.tag,
            marketplace=self.marketplace
        )
        orig = raw.get("original_price", 0.0)
        curr = raw.get("current_price", 0.0)
        discount = round(((orig - curr) / orig) * 100, 1) if orig > curr and orig > 0 else 0.0

        return Product(
            id=f"prod_{raw['asin']}",
            asin=raw["asin"],
            title=raw["title"],
            category=raw["category"],
            original_price=orig,
            current_price=curr,
            currency=raw.get("currency", "INR"),
            discount_percent=discount,
            rating=raw.get("rating", 4.0),
            review_count=raw.get("review_count", 100),
            affiliate_url=affiliate_url,
            canonical_url=canonical_url,
            image_urls=raw.get("image_urls", []),
            features=raw.get("features", []),
            availability=AvailabilityStatus.IN_STOCK,
            discovery_source=DiscoverySource.MANUAL_SEED,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

    def search_products(self, query: str, category: Optional[str] = None, limit: int = 10) -> List[Product]:
        q = query.lower()
        results = []
        for item in SEED_PRODUCTS:
            matches_q = q in item["title"].lower() or q in item["category"].lower() or any(q in f.lower() for f in item["features"])
            matches_cat = (category.lower() in item["category"].lower()) if category else True
            if matches_q and matches_cat:
                results.append(self._to_product(item))
            if len(results) >= limit:
                break
        return results

    def get_trending_products(self, category: Optional[str] = None, limit: int = 10) -> List[Product]:
        results = []
        for item in SEED_PRODUCTS:
            if not category or category.lower() in item["category"].lower():
                results.append(self._to_product(item))
            if len(results) >= limit:
                break
        return results

    def get_product_by_asin(self, asin: str) -> Optional[Product]:
        for item in SEED_PRODUCTS:
            if item["asin"] == asin:
                return self._to_product(item)
        return None
