"""Audio feature extraction shared by inference and genre-model training.

The feature vector consists of:
  * 527 AudioSet class probabilities from the AST tagger, averaged over up to three 10-second windows;
  * 67 classic DSP descriptors (MFCC, chroma, spectral shape, RMS, tempo).

The same function is used to build the training dataset and to analyse user tracks, so the genre
classifier always sees features computed in exactly the same way.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

import librosa
import numpy as np
from transformers.audio_utils import mel_filter_bank, spectrogram, window_function

from app.core.taxonomy import PITCH_CLASSES

logger = logging.getLogger("sortund-ai-pipeline")

SAMPLE_RATE = 16000
MAX_ANALYSIS_SECONDS = 30.0
AST_WINDOW_SECONDS = 10.24
AST_MAX_FRAMES = 1024
AST_MEAN = -4.2677393
AST_STD = 4.5689974
NUM_AUDIOSET_CLASSES = 527
NUM_DSP_FEATURES = 67
FEATURE_SIZE = NUM_AUDIOSET_CLASSES + NUM_DSP_FEATURES

_MEL_FILTERS = mel_filter_bank(
    num_frequency_bins=257,
    num_mel_filters=128,
    min_frequency=20,
    max_frequency=SAMPLE_RATE // 2,
    sampling_rate=SAMPLE_RATE,
    norm=None,
    mel_scale="kaldi",
    triangularize_in_mel_space=True,
)
_WINDOW = window_function(400, "hann", periodic=False)

# Krumhansl–Schmuckler key profiles.
_MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


@dataclass
class DspSummary:
    bpm: Optional[float]
    key: Optional[str]
    key_confidence: float
    rms_mean: float
    vector: np.ndarray


def load_audio(path: str, max_seconds: float = MAX_ANALYSIS_SECONDS) -> np.ndarray:
    """Loads mono audio at 16 kHz, limited to the first ``max_seconds`` seconds."""
    y, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True, duration=max_seconds)
    return y.astype(np.float32)


def ast_input_from_waveform(waveform: np.ndarray) -> np.ndarray:
    """Builds the normalised log-mel fbank (1024 x 128) the AST model expects."""
    fbank = spectrogram(
        np.squeeze(waveform),
        _WINDOW,
        frame_length=400,
        hop_length=160,
        fft_length=512,
        power=2.0,
        center=False,
        preemphasis=0.97,
        mel_filters=_MEL_FILTERS,
        log_mel="log",
        mel_floor=1.192092955078125e-07,
        remove_dc_offset=True,
    ).T
    n_frames = fbank.shape[0]
    if n_frames < AST_MAX_FRAMES:
        fbank = np.pad(fbank, ((0, AST_MAX_FRAMES - n_frames), (0, 0)))
    else:
        fbank = fbank[:AST_MAX_FRAMES]
    fbank = (fbank - AST_MEAN) / (AST_STD * 2)
    return fbank.astype(np.float32)


def split_ast_windows(y: np.ndarray, max_windows: int = 3) -> List[np.ndarray]:
    """Splits audio into up to ``max_windows`` non-overlapping 10.24 s windows (at least one)."""
    window = int(AST_WINDOW_SECONDS * SAMPLE_RATE)
    windows = [y[start : start + window] for start in range(0, max(len(y), 1), window)]
    # Drop a short tail window unless it is the only one.
    windows = [w for i, w in enumerate(windows) if i == 0 or len(w) >= window // 2]
    return windows[:max_windows] or [y]


def estimate_key(chroma_mean: np.ndarray) -> Tuple[Optional[str], float]:
    """Estimates the musical key with the Krumhansl–Schmuckler algorithm."""
    if not np.any(chroma_mean > 0):
        return None, 0.0
    scores = []
    for shift in range(12):
        rotated = np.roll(chroma_mean, -shift)
        scores.append((np.corrcoef(rotated, _MAJOR_PROFILE)[0, 1], f"{PITCH_CLASSES[shift]} major"))
        scores.append((np.corrcoef(rotated, _MINOR_PROFILE)[0, 1], f"{PITCH_CLASSES[shift]} minor"))
    scores.sort(key=lambda s: s[0], reverse=True)
    best, second = scores[0], scores[1]
    if not np.isfinite(best[0]):
        return None, 0.0
    # Confidence: how clearly the best key beats the runner-up, squashed to 0..1.
    confidence = float(np.clip(best[0], 0, 1) * np.clip((best[0] - second[0]) * 10, 0.2, 1))
    return best[1], round(confidence, 3)


def compute_dsp(y: np.ndarray, sr: int = SAMPLE_RATE) -> DspSummary:
    """Computes tempo, key and a fixed-size vector of DSP descriptors."""
    if y.size < sr // 2 or float(np.max(np.abs(y))) < 1e-4:
        return DspSummary(None, None, 0.0, 0.0, np.zeros(NUM_DSP_FEATURES, dtype=np.float32))

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    rms = librosa.feature.rms(y=y)[0]
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo = librosa.feature.tempo(onset_envelope=onset_env, sr=sr, aggregate=np.median)
    bpm = float(np.atleast_1d(tempo)[0]) if tempo is not None else 0.0

    chroma_cqt = librosa.feature.chroma_cqt(y=y, sr=sr)
    key, key_confidence = estimate_key(chroma_cqt.mean(axis=1))

    vector = np.concatenate(
        [
            mfcc.mean(axis=1),
            mfcc.std(axis=1),
            chroma.mean(axis=1),
            [centroid.mean() / 1000.0, centroid.std() / 1000.0],
            [bandwidth.mean() / 1000.0],
            [rolloff.mean() / 1000.0],
            [zcr.mean()],
            [rms.mean(), rms.std()],
            contrast.mean(axis=1),
            [bpm / 100.0],
        ]
    ).astype(np.float32)
    assert vector.shape[0] == NUM_DSP_FEATURES, vector.shape

    return DspSummary(
        bpm=round(bpm, 1) if bpm > 0 else None,
        key=key,
        key_confidence=key_confidence,
        rms_mean=float(rms.mean()),
        vector=vector,
    )


def build_feature_vector(audioset_probs: np.ndarray, dsp: DspSummary) -> np.ndarray:
    return np.concatenate([audioset_probs.astype(np.float32), dsp.vector]).astype(np.float32)


def embedding_from_features(features: np.ndarray, mean: np.ndarray, scale: np.ndarray) -> np.ndarray:
    """L2-normalised, standardised feature vector used for "similar tracks" search."""
    z = (features - mean) / np.where(scale == 0, 1.0, scale)
    norm = float(np.linalg.norm(z))
    return (z / norm if norm > 0 else z).astype(np.float32)
