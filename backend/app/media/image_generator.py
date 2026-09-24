import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from app.config import settings
from app.database.models import Product, ContentVariant

class VisualGenerator:
    """
    Renders high-impact, professional 1080x1920 vertical canvas cards
    using Pillow without external paid APIs.
    """

    WIDTH = 1080
    HEIGHT = 1920

    @classmethod
    def create_product_card(cls, product: Product, variant: ContentVariant, output_path: str) -> str:
        # 1. Create base background with modern sleek dark gradient
        image = Image.new("RGB", (cls.WIDTH, cls.HEIGHT), color=(15, 23, 42)) # Deep slate #0f172a
        draw = ImageDraw.Draw(image)

        # Draw aesthetic ambient glow circles
        draw.ellipse([(-100, -100), (500, 500)], fill=(30, 58, 138)) # Deep blue glow
        draw.ellipse([(600, 1400), (1200, 2000)], fill=(76, 29, 149)) # Indigo glow

        # Card container box (glassmorphism effect)
        card_box = [80, 220, 1000, 1700]
        draw.rounded_rectangle(card_box, radius=40, fill=(30, 41, 59), outline=(59, 130, 246), width=3)

        # Top Header: Category Tag & Brand
        draw.rounded_rectangle([120, 260, 480, 320], radius=15, fill=(37, 99, 235))
        draw.text((140, 275), product.category[:26].upper(), fill=(255, 255, 255))
        draw.text((620, 275), "@mybudgetdeal99", fill=(148, 163, 184))

        # Main Hook / Title Box
        hook_preview = variant.hook_text
        if len(hook_preview) > 90:
            hook_preview = hook_preview[:87] + "..."
        draw.text((120, 370), "🔥 DEAL ALERT", fill=(245, 158, 11))
        draw.text((120, 430), hook_preview[:45], fill=(255, 255, 255))
        if len(hook_preview) > 45:
            draw.text((120, 480), hook_preview[45:90], fill=(255, 255, 255))

        # Product Title
        title_disp = product.title[:75]
        draw.text((120, 570), title_disp[:38], fill=(226, 232, 240))
        if len(title_disp) > 38:
            draw.text((120, 615), title_disp[38:75], fill=(226, 232, 240))

        # Rating & Social Proof
        stars = "★" * int(min(5, max(1, product.rating)))
        draw.text((120, 680), f"{stars} ({product.rating:.1f}/5) • {product.review_count:,} Reviews", fill=(250, 204, 21))

        # Price Drop Highlight Pill
        draw.rounded_rectangle([120, 750, 960, 890], radius=25, fill=(16, 185, 129)) # Emerald green banner
        draw.text((150, 770), f"NOW ONLY: ₹{product.current_price:.0f}", fill=(255, 255, 255))
        if product.original_price > product.current_price:
            draw.text((150, 830), f"MRP: ₹{product.original_price:.0f}  ({product.discount_percent:.0f}% OFF)", fill=(240, 253, 244))

        # Feature Highlights Box
        draw.text((120, 940), "✨ KEY HIGHLIGHTS:", fill=(56, 189, 248))
        y_cursor = 1000
        for feat in product.features[:3]:
            feat_text = f"• {feat[:42]}"
            draw.text((130, y_cursor), feat_text, fill=(203, 213, 225))
            y_cursor += 60

        # Call to Action Banner
        draw.rounded_rectangle([120, 1240, 960, 1370], radius=20, fill=(239, 68, 68)) # Vibrant red CTA
        draw.text((180, 1275), "👉 TAP LINK IN BIO TO BUY NOW 👈", fill=(255, 255, 255))

        # Website and affiliate tag
        draw.text((120, 1420), "Visit: adarshchauhan095.github.io/my-budget-deal-99", fill=(148, 163, 184))

        # Strict FTC & Amazon Disclosure Footer
        disclosure = "As an Amazon Associate I earn from qualifying purchases. #ad"
        draw.text((120, 1550), disclosure, fill=(100, 116, 139))
        draw.text((120, 1600), "Prices subject to change on Amazon. Available while stock lasts.", fill=(71, 85, 105))

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path, "JPEG", quality=92)
        return output_path
