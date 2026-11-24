"""Pure functions that turn model outputs into labelled tags with confidences."""

from typing import Dict, List, Optional, Tuple

import numpy as np

from app.core.settings import settings
from app.core.taxonomy import (
    FEMALE_SINGING_INDEX,
    FEMALE_SPEECH_INDEX,
    INSTRUMENT_INDICES,
    INSTRUMENT_REDUNDANT_PARENTS,
    MALE_SINGING_INDEX,
    MALE_SPEECH_INDEX,
    MOOD_AUDIOSET,
    MOOD_LABELS,
    MOOD_REFERENCE,
    RAPPING_INDEX,
    SINGING_INDICES,
    SPEECH_INDEX,
    STYLE_AUDIOSET,
)
from app.schemas.analysis import LabelScore, Tag


def _round(value: float) -> float:
    return round(float(value), 3)


def detect_instruments(probs: np.ndarray, threshold: Optional[float] = None, limit: int = 6) -> List[LabelScore]:
    threshold = settings.INSTRUMENT_THRESHOLD if threshold is None else threshold
    found = {name: float(probs[idx]) for idx, name in INSTRUMENT_INDICES.items() if probs[idx] >= threshold}
    for parent, children in INSTRUMENT_REDUNDANT_PARENTS.items():
        if parent in found and any(child in found for child in children):
            del found[parent]
    ranked = sorted(found.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [LabelScore(label=name, confidence=_round(p)) for name, p in ranked]


def detect_styles(probs: np.ndarray, threshold: Optional[float] = None, limit: int = 3) -> List[LabelScore]:
    threshold = settings.STYLE_THRESHOLD if threshold is None else threshold
    found: Dict[str, float] = {}
    for idx, name in STYLE_AUDIOSET.items():
        if probs[idx] >= threshold:
            found[name] = max(found.get(name, 0.0), float(probs[idx]))
    ranked = sorted(found.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [LabelScore(label=name, confidence=_round(p)) for name, p in ranked]


def detect_vocal(probs: np.ndarray, threshold: Optional[float] = None) -> Tuple[str, float, bool]:
    """Returns (vocal_label, confidence, has_vocals). Labels: male | female | rap | instrumental."""
    threshold = settings.VOCAL_THRESHOLD if threshold is None else threshold
    singing = float(max(probs[i] for i in SINGING_INDICES))
    rap = float(probs[RAPPING_INDEX])
    # AudioSet often hears rap as "speech", so speech counts as weaker evidence of vocals.
    speech = float(probs[SPEECH_INDEX])
    presence = max(singing, rap, 0.5 * speech)

    if presence < threshold:
        confidence = 0.5 + 0.5 * float(np.clip(1 - presence / threshold, 0, 1))
        return "instrumental", _round(confidence), False

    male = float(probs[MALE_SINGING_INDEX]) + 0.5 * float(probs[MALE_SPEECH_INDEX])
    female = float(probs[FEMALE_SINGING_INDEX]) + 0.5 * float(probs[FEMALE_SPEECH_INDEX])
    # Speech counts towards rap only when there is little singing and some direct rap evidence.
    speech_bonus = 0.2 * speech if singing < threshold and rap >= 0.005 else 0.0
    scores = {"male": male, "female": female, "rap": rap * 1.5 + speech_bonus}
    total = sum(scores.values())
    if total <= 1e-6:
        return "male", 0.5, True
    label = max(scores, key=lambda k: scores[k])
    return label, _round(scores[label] / total), True


def audio_mood_scores(probs: np.ndarray, bpm: Optional[float], rms_mean: float) -> Dict[str, float]:
    """Mood distribution (sums to 1) from AudioSet mood classes plus loudness / tempo cues.

    Each AudioSet class is divided by its average over the training dataset, so a value of 2 means
    "twice as typical for this mood as an average track".
    """

    def rel(idx: int) -> float:
        return float(probs[idx]) / MOOD_REFERENCE[idx]

    loudness = float(np.clip(rms_mean / 0.15, 0, 1.5))
    tempo = float(np.clip(((bpm or 100) - 70) / 80, 0, 1))

    raw = {mood: 0.0 for mood in MOOD_LABELS}
    for idx, mood in MOOD_AUDIOSET.items():
        raw[mood] = max(raw[mood], rel(idx))
    raw["calm"] = 0.5 * max(rel(246), rel(253), rel(271)) + 1.5 * max(0.0, 1 - loudness)
    raw["energetic"] += 1.5 * loudness * tempo

    total = sum(raw.values())
    if total <= 1e-9:
        return {mood: 1.0 / len(MOOD_LABELS) for mood in MOOD_LABELS}
    return {mood: value / total for mood, value in raw.items()}


def combine_scores(primary: Dict[str, float], secondary: Dict[str, float], primary_weight: float) -> Dict[str, float]:
    """Weighted average of two distributions over the same labels; falls back to ``primary``."""
    if not secondary:
        return dict(primary)
    labels = set(primary) | set(secondary)
    combined = {
        label: primary_weight * primary.get(label, 0.0) + (1 - primary_weight) * secondary.get(label, 0.0)
        for label in labels
    }
    total = sum(combined.values()) or 1.0
    return {label: value / total for label, value in combined.items()}


def ranked(scores: Dict[str, float], threshold: float = 0.0, limit: int = 3) -> List[LabelScore]:
    items = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return [LabelScore(label=k, confidence=_round(v)) for k, v in items if v >= threshold][:limit]


def build_tags(
    genre: Optional[LabelScore],
    styles: List[LabelScore],
    moods: List[LabelScore],
    instruments: List[LabelScore],
    vocal: Optional[LabelScore],
    language: Optional[LabelScore],
    themes: List[LabelScore],
    threshold: Optional[float] = None,
) -> List[Tag]:
    """Flattens all detections into one tag list, dropping those below the confidence threshold."""
    threshold = settings.TAG_THRESHOLD if threshold is None else threshold
    tags: List[Tag] = []

    def add(item: Optional[LabelScore], category: str, min_conf: float) -> None:
        if item and item.confidence >= min_conf and not any(t.label == item.label for t in tags):
            tags.append(Tag(label=item.label, category=category, confidence=item.confidence))

    add(genre, "genre", threshold)
    for s in styles:
        add(s, "style", settings.STYLE_THRESHOLD)
    for m in moods:
        add(m, "mood", threshold * 0.6)
    for i in instruments:
        add(i, "instrument", settings.INSTRUMENT_THRESHOLD)
    add(vocal, "vocal", threshold)
    add(language, "language", threshold)
    for t in themes:
        add(t, "theme", settings.THEME_THRESHOLD)
    return tags
