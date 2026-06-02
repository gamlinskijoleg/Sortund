import sys
import logging
from typing import List, Dict, Set


def setup_logging():
    """Налаштовує логування з підтримкою UTF-8 для запобігання UnicodeEncodeError на Windows."""
    logger = logging.getLogger("sortund-ai-pipeline")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        # Примусово змушуємо стрім писати в UTF-8
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
        )
        try:
            stream_handler.stream = open(
                sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False
            )
        except Exception:
            pass
        logger.addHandler(stream_handler)


CANDIDATE_LABELS: List[str] = [
    "rock music",
    "pop music",
    "electronic music",
    "hip hop music",
    "jazz music",
    "sad mood",
    "energetic gym workout",
    "calm chillout",
    "night drive vibe",
]

MOOD_LABELS: Set[str] = {
    "sad mood",
    "energetic gym workout",
    "calm chillout",
    "night drive vibe",
}
GENRE_LABELS: Set[str] = {
    "rock music",
    "pop music",
    "electronic music",
    "hip hop music",
    "jazz music",
}
CUSTOM_CONTEXT_LABELS = [
    "eurovision song contest",
    "after workout in public transport",  # моделі краще згодовувати англійською
    "romantic dinner",
    "gaming focus",
]


AUDIO_LABELS: Dict[int, str] = {
    137: "Music",
    138: "Musical instrument",
    139: "Plucked string instrument",
    140: "Guitar",
    141: "Electric guitar",
    144: "Bass guitar",
    147: "Acoustic guitar",
    150: "Keyboard instrument",
    151: "Piano",
    161: "Synthesizer",
    173: "Drum kit",
    180: "Singing",
    181: "Choir",
    183: "Male singing",
    184: "Female singing",
    185: "Rap",
    201: "Techno",
    202: "Club music",
    203: "Electronic dance music",
}

ENERGETIC_TRIGGERS: List[str] = [
    "Electric guitar",
    "Guitar",
    "Rap",
    "Techno",
    "Club music",
    "Electronic dance music",
    "Drum kit",
    "Singing",
]
