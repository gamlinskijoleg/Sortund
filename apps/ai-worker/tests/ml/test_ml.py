import base64

import numpy as np
import pytest

from app.core.taxonomy import MOOD_LABELS
from app.ml.features import (
    AST_MAX_FRAMES,
    FEATURE_SIZE,
    NUM_AUDIOSET_CLASSES,
    SAMPLE_RATE,
    ast_input_from_waveform,
    compute_dsp,
    embedding_from_features,
    estimate_key,
    split_ast_windows,
)
from app.ml.genre_model import GenreModel, evaluate, split_indices, train_model
from app.ml.tagging import (
    audio_mood_scores,
    build_tags,
    combine_scores,
    detect_instruments,
    detect_styles,
    detect_vocal,
    ranked,
)
from app.schemas.analysis import LabelScore
from app.services.fingerprint import fingerprint_for, local_fingerprint
from app.schemas.analysis import Recognition


def probs_with(**values):
    p = np.zeros(NUM_AUDIOSET_CLASSES, dtype=np.float32)
    for idx, v in values.items():
        p[int(idx.lstrip("i"))] = v
    return p


# ── Tagging ─────────────────────────────────────────────────────────────────


def test_detect_vocal_instrumental():
    label, conf, has_vocals = detect_vocal(probs_with(i153=0.8))
    assert (label, has_vocals) == ("instrumental", False)
    assert 0.5 <= conf <= 1


def test_detect_vocal_female_and_rap():
    label, _, has = detect_vocal(probs_with(i27=0.4, i33=0.3, i32=0.05))
    assert (label, has) == ("female", True)
    label, _, _ = detect_vocal(probs_with(i36=0.5, i27=0.05))
    assert label == "rap"


def test_detect_instruments_drops_redundant_parent_and_low_scores():
    found = detect_instruments(probs_with(i140=0.5, i141=0.4, i153=0.01))
    assert [i.label for i in found] == ["Electric guitar"]


def test_detect_styles():
    assert [s.label for s in detect_styles(probs_with(i241=0.4))] == ["techno"]


def test_mood_scores_sum_to_one_and_follow_cues():
    quiet = audio_mood_scores(probs_with(i246=0.01), bpm=60, rms_mean=0.01)
    loud = audio_mood_scores(probs_with(i280=0.05), bpm=150, rms_mean=0.25)
    assert set(quiet) == set(MOOD_LABELS)
    assert abs(sum(quiet.values()) - 1) < 1e-6
    assert max(quiet, key=quiet.get) == "calm"
    assert max(loud, key=loud.get) == "energetic"


def test_combine_and_rank():
    combined = combine_scores({"a": 1.0, "b": 0.0}, {"a": 0.0, "b": 1.0}, 0.75)
    assert combined["a"] == pytest.approx(0.75)
    assert combine_scores({"a": 1.0}, {}, 0.5) == {"a": 1.0}
    assert [r.label for r in ranked({"x": 0.1, "y": 0.5, "z": 0.3}, threshold=0.2)] == ["y", "z"]


def test_build_tags_applies_threshold():
    tags = build_tags(
        genre=LabelScore(label="rock", confidence=0.9),
        styles=[],
        moods=[LabelScore(label="sad", confidence=0.05)],
        instruments=[LabelScore(label="Piano", confidence=0.5)],
        vocal=LabelScore(label="male", confidence=0.2),
        language=None,
        themes=[LabelScore(label="love", confidence=0.6)],
        threshold=0.35,
    )
    labels = {t.label: t.category for t in tags}
    assert labels == {"rock": "genre", "Piano": "instrument", "love": "theme"}


# ── Features ────────────────────────────────────────────────────────────────


def test_ast_input_shape_and_windows():
    y = np.random.default_rng(0).normal(scale=0.1, size=SAMPLE_RATE * 25).astype(np.float32)
    windows = split_ast_windows(y)
    assert len(windows) == 2  # 25 s -> two full 10.24 s windows, short tail dropped
    assert ast_input_from_waveform(windows[0]).shape == (AST_MAX_FRAMES, 128)


def test_estimate_key_recognises_c_major_profile():
    profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    key, conf = estimate_key(profile)
    assert key == "C major" and conf > 0
    key_a_minor, _ = estimate_key(
        np.roll(np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]), 9)
    )
    assert key_a_minor == "A minor"


def test_compute_dsp_tempo_of_click_track():
    sr = SAMPLE_RATE
    y = np.zeros(sr * 12, dtype=np.float32)
    beat = int(sr * 60 / 120)
    for start in range(0, len(y), beat):
        y[start : start + 200] = np.hanning(200) * 0.8
    dsp = compute_dsp(y)
    assert dsp.vector.shape[0] + NUM_AUDIOSET_CLASSES == FEATURE_SIZE
    assert dsp.bpm is not None and abs(dsp.bpm - 120) < 6


def test_compute_dsp_silence():
    dsp = compute_dsp(np.zeros(SAMPLE_RATE * 2, dtype=np.float32))
    assert dsp.bpm is None and dsp.key is None and not dsp.vector.any()


def test_embedding_is_normalised():
    emb = embedding_from_features(np.arange(5, dtype=np.float32), np.zeros(5), np.ones(5))
    assert np.linalg.norm(emb) == pytest.approx(1.0)


# ── Genre model ─────────────────────────────────────────────────────────────


def _dataset(n=40, d=8):
    rng = np.random.default_rng(3)
    x = rng.normal(size=(n * 2, d))
    x[:n, 0] += 4
    return x, ["a"] * n + ["b"] * n


def test_split_is_deterministic_and_stratified():
    _, labels = _dataset()
    train1, test1 = split_indices(labels)
    train2, test2 = split_indices(labels)
    assert (train1 == train2).all() and (test1 == test2).all()
    assert sum(labels[i] == "a" for i in test1) == sum(labels[i] == "b" for i in test1) == 8
    assert not set(train1) & set(test1)


def test_train_evaluate_and_serialise():
    x, labels = _dataset()
    model, metrics = train_model("vt", x, labels, regularization=1.0)
    assert metrics["accuracy"] > 0.9
    assert set(metrics["f1_per_genre"]) == {"a", "b"}
    assert np.asarray(metrics["confusion_matrix"]).sum() == metrics["test_samples"]

    restored = GenreModel.from_bytes("vt", model.to_bytes())
    assert restored.predict(x[0]) == pytest.approx(model.predict(x[0]))
    assert base64.b64encode(model.to_bytes())


def test_corrections_with_unknown_labels_are_ignored():
    x, labels = _dataset()
    _, metrics = train_model("vt", x, labels, extra_features=x[:2], extra_labels=["a", "unknown"], regularization=1.0)
    assert metrics["corrections_used"] == 1


def test_evaluate_ignores_unknown_labels():
    x, labels = _dataset()
    model, _ = train_model("vt", x, labels, regularization=1.0)
    assert evaluate(model, x[:2], ["a", "zzz"])["test_samples"] == 1


# ── Fingerprint ─────────────────────────────────────────────────────────────


def test_fingerprint_prefers_shazam_key():
    y = np.zeros(10, dtype=np.float32)
    assert fingerprint_for(Recognition(artist="a", title="b", shazam_key="77"), y) == "shz:77"


def test_local_fingerprint_is_deterministic_and_content_based():
    t = np.arange(SAMPLE_RATE * 6) / SAMPLE_RATE
    a = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    b = (0.3 * np.sin(2 * np.pi * 330 * t)).astype(np.float32)
    assert local_fingerprint(a) == local_fingerprint(a.copy())
    assert local_fingerprint(a).startswith("loc:")
    assert local_fingerprint(a) != local_fingerprint(b)
