import os
import subprocess
import logging
from pathlib import Path
from typing import Optional
from app.config import settings
from app.database.models import Product, ContentVariant
from app.media.image_generator import VisualGenerator
from app.media.audio_generator import AudioGenerator

logger = logging.getLogger(__name__)

class VideoEngine:
    """
    Composites vertical 9:16 short-form videos using local FFmpeg and Pillow.
    Guarantees copyright-safe procedural output with zero cloud rendering costs.
    """

    @classmethod
    def render_short_video(
        cls,
        product: Product,
        variant: ContentVariant,
        duration_sec: int = 5
    ) -> str:
        safe_asin = product.asin.replace("/", "_")
        safe_var = variant.id.replace("/", "_")

        temp_img_path = str(Path(settings.MEDIA_TEMP_DIR) / f"card_{safe_asin}_{safe_var}.jpg")
        temp_audio_path = str(Path(settings.MEDIA_TEMP_DIR) / f"audio_{safe_asin}_{safe_var}.wav")
        output_video_path = str(Path(settings.MEDIA_RENDER_DIR) / f"render_{safe_asin}_{safe_var}.mp4")

        # 1. Render Visual Canvas
        VisualGenerator.create_product_card(product, variant, temp_img_path)

        # 2. Render Audio Track
        AudioGenerator.create_ambient_track(temp_audio_path, duration_sec=duration_sec)

        # 3. Composite Video via local FFmpeg
        # Generates smooth 1080x1920 30fps MP4 with AAC audio
        cmd = [
            "ffmpeg",
            "-y",  # Overwrite output
            "-loop", "1",
            "-i", temp_img_path,
            "-i", temp_audio_path,
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-t", str(duration_sec),
            "-vf", "scale=1080:1920",
            output_video_path
        ]

        logger.info("Executing FFmpeg render command: %s", " ".join(cmd))
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        if result.returncode != 0:
            logger.error("FFmpeg render failed: %s", result.stderr)
            raise RuntimeError(f"FFmpeg render error: {result.stderr[-300:]}")

        logger.info("Successfully rendered video to %s", output_video_path)
        return output_video_path
