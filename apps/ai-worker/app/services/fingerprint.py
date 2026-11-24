"""Acoustic fingerprint used as the cache / sync key of a track.

When Shazam recognises the track, its catalogue key identifies the recording independently of the
file encoding, so the same song uploaded by different users maps to the same fingerprint.
Otherwise a local fingerprint is derived from the chroma sequence of the first 20 seconds.
"""

import hashlib
from typing import Optional

import librosa
import numpy as np

from app.ml.features import SAMPLE_RATE
from app.schemas.analysis import Recognition

LOCAL_SECONDS = 20
BLOCK_SECONDS = 2


def local_fingerprint(y: np.ndarray, sr: int = SAMPLE_RATE) -> str:
    """Coarse chroma fingerprint: dominant pitch-class pair per 2-second block."""
    segment = y[: LOCAL_SECONDS * sr]
    if segment.size < sr or float(np.max(np.abs(segment))) < 1e-4:
        digest = hashlib.sha1(segment.tobytes()).hexdigest()
        return f"raw:{digest[:24]}"

    chroma = librosa.feature.chroma_stft(y=segment, sr=sr, hop_length=2048)
    frames_per_block = max(1, int(BLOCK_SECONDS * sr / 2048))
    symbols = []
    for start in range(0, chroma.shape[1], frames_per_block):
        block = chroma[:, start : start + frames_per_block].mean(axis=1)
        first, second = np.argsort(block)[::-1][:2]
        symbols.append(f"{first:x}{second:x}")
    digest = hashlib.sha1("".join(symbols).encode()).hexdigest()
    return f"loc:{digest[:24]}"


def fingerprint_for(recognition: Optional[Recognition], y: np.ndarray) -> str:
    if recognition and recognition.shazam_key:
        return f"shz:{recognition.shazam_key}"
    return local_fingerprint(y)
