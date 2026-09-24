import wave
import math
import struct
from pathlib import Path

class AudioGenerator:
    """
    Generates zero-cost, royalty-safe background audio tones and synth swells
    using Python's native standard library (wave & struct).
    """

    @classmethod
    def create_ambient_track(cls, output_path: str, duration_sec: int = 5, sample_rate: int = 44100) -> str:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        num_samples = int(duration_sec * sample_rate)

        with wave.open(output_path, "w") as wav_file:
            # 1 channel (mono), 2 bytes per sample (16-bit), sample_rate
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)

            # Generate pleasant subtle harmonic chord tones
            freqs = [220.0, 330.0, 440.0]
            frames = bytearray()

            for i in range(num_samples):
                t = i / sample_rate
                # Envelope: gentle fade-in and fade-out
                envelope = min(1.0, t / 0.5) * min(1.0, (duration_sec - t) / 0.5)
                sample_val = 0.0
                for f in freqs:
                    sample_val += math.sin(2.0 * math.pi * f * t) * (1.0 / len(freqs))

                sample_int = int(sample_val * envelope * 12000.0) # max amplitude ~12000
                frames.extend(struct.pack("<h", sample_int))

            wav_file.writeframes(frames)

        return output_path
