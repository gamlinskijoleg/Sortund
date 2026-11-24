"""Groupings of AudioSet classes and label vocabularies used to turn raw model output into tags.

AudioSet indices refer to the 527 outputs of the AST audio tagger (see ``AUDIO_LABELS`` in constants.py).
"""

from typing import Dict, List, Tuple

# ── Instruments ─────────────────────────────────────────────────────────────
# Generic umbrella classes are excluded so that only concrete instruments become tags.
INSTRUMENT_INDICES: Dict[int, str] = {
    140: "Guitar",
    141: "Electric guitar",
    142: "Bass guitar",
    143: "Acoustic guitar",
    147: "Banjo",
    148: "Sitar",
    149: "Mandolin",
    151: "Ukulele",
    153: "Piano",
    154: "Electric piano",
    155: "Organ",
    158: "Synthesizer",
    159: "Sampler",
    160: "Harpsichord",
    162: "Drum kit",
    163: "Drum machine",
    169: "Timpani",
    170: "Tabla",
    180: "Marimba",
    181: "Glockenspiel",
    182: "Vibraphone",
    183: "Steelpan",
    184: "Orchestra",
    185: "Brass",
    186: "French horn",
    187: "Trumpet",
    188: "Trombone",
    190: "String section",
    191: "Violin",
    193: "Cello",
    194: "Double bass",
    196: "Flute",
    197: "Saxophone",
    198: "Clarinet",
    199: "Harp",
    208: "Harmonica",
    209: "Accordion",
    210: "Bagpipes",
    215: "Scratching",
}

# Children that make a parent tag redundant when both are present.
INSTRUMENT_REDUNDANT_PARENTS: Dict[str, List[str]] = {
    "Guitar": ["Electric guitar", "Acoustic guitar", "Bass guitar"],
    "Organ": ["Electric piano"],
}

# ── Vocals ──────────────────────────────────────────────────────────────────
SINGING_INDICES: List[int] = [27, 28, 32, 33, 34, 35, 254, 255, 266]
RAPPING_INDEX = 36
MALE_SINGING_INDEX = 32
FEMALE_SINGING_INDEX = 33
MALE_SPEECH_INDEX = 1
FEMALE_SPEECH_INDEX = 2
SPEECH_INDEX = 0

VOCAL_LABELS: Tuple[str, ...] = ("male", "female", "rap", "instrumental")

# ── Mood ────────────────────────────────────────────────────────────────────
# AudioSet "music mood" classes mapped onto the app's mood vocabulary.
MOOD_AUDIOSET: Dict[int, str] = {
    276: "happy",
    277: "happy",
    278: "sad",
    279: "romantic",
    280: "energetic",
    281: "aggressive",
    282: "dark",
}

# Mean probability of each mood-related AudioSet class over the GTZAN dataset. Raw mood probabilities
# are tiny (~0.01), so each class is compared with its own average instead of absolute values.
MOOD_REFERENCE: Dict[int, float] = {
    276: 0.01225,
    277: 0.00382,
    278: 0.00596,
    279: 0.0088,
    280: 0.01198,
    281: 0.00494,
    282: 0.00049,
    246: 0.00056,
    253: 0.00279,
    271: 0.00414,
}

MOOD_LABELS: Tuple[str, ...] = ("energetic", "happy", "calm", "sad", "romantic", "aggressive", "dark")

# Hypotheses for the zero-shot text model (applied to lyrics when available).
MOOD_TEXT_HYPOTHESES: Dict[str, str] = {
    "energetic": "energetic and upbeat",
    "happy": "happy and joyful",
    "calm": "calm and relaxing",
    "sad": "sad and melancholic",
    "romantic": "romantic and tender",
    "aggressive": "aggressive and angry",
    "dark": "dark and gloomy",
}

# ── Themes (from lyrics) ────────────────────────────────────────────────────
THEME_HYPOTHESES: Dict[str, str] = {
    "love": "love and relationships",
    "heartbreak": "heartbreak and breakup",
    "party": "partying and dancing",
    "friendship": "friendship",
    "freedom": "freedom and independence",
    "struggle": "struggle and hardship",
    "war": "war and conflict",
    "homeland": "homeland and patriotism",
    "nature": "nature",
    "nostalgia": "nostalgia and memories",
    "success": "money, fame and success",
    "faith": "faith and spirituality",
    "society": "society and politics",
    "loneliness": "loneliness",
    "self-confidence": "self-confidence",
}

# ── Genres for the zero-shot text prior (by artist and title) ───────────────
# Keys must match the labels of the trained genre classifier.
GENRE_TEXT_HYPOTHESES: Dict[str, str] = {
    "blues": "blues",
    "classical": "classical music",
    "country": "country music",
    "disco": "disco",
    "hiphop": "hip hop or rap",
    "jazz": "jazz",
    "metal": "heavy metal",
    "pop": "pop music",
    "reggae": "reggae",
    "rock": "rock music",
}

# Extra genre-like styles the audio tagger can spot that are outside the trained classifier's labels.
STYLE_AUDIOSET: Dict[int, str] = {
    239: "electronic",
    240: "house",
    241: "techno",
    242: "dubstep",
    243: "drum and bass",
    246: "ambient",
    247: "trance",
    226: "r&b",
    227: "soul",
    232: "funk",
    233: "folk",
    221: "punk",
    238: "opera",
    263: "ska",
    270: "soundtrack",
    272: "video game music",
    273: "christmas",
    271: "lullaby",
}

# ── Musical keys ────────────────────────────────────────────────────────────
PITCH_CLASSES: Tuple[str, ...] = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
