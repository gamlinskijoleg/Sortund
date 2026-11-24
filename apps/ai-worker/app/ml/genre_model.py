"""Own genre classifier: a multinomial logistic regression trained on AST + DSP features.

Versions are stored as small ``.npz`` files (weights only — no pickles) in ``GENRE_MODEL_DIR``.
Every version is evaluated on the same held-out test split of the base dataset, so metrics of
different versions are directly comparable.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

from app.core.settings import settings

logger = logging.getLogger("sortund-ai-pipeline")

BASE_DATASET_FILE = "base_dataset.npz"
TEST_FRACTION = 0.2
SPLIT_SEED = 42
VERSION_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


@dataclass
class GenreModel:
    version: str
    labels: List[str]
    mean: np.ndarray
    scale: np.ndarray
    coef: np.ndarray
    intercept: np.ndarray

    def predict_proba(self, features: np.ndarray) -> np.ndarray:
        x = (np.atleast_2d(features) - self.mean) / self.scale
        logits = x @ self.coef.T + self.intercept
        logits -= logits.max(axis=1, keepdims=True)
        exp = np.exp(logits)
        return exp / exp.sum(axis=1, keepdims=True)

    def predict(self, features: np.ndarray) -> Dict[str, float]:
        probs = self.predict_proba(features)[0]
        return {label: float(p) for label, p in zip(self.labels, probs)}

    def to_bytes(self) -> bytes:
        buffer = io.BytesIO()
        np.savez_compressed(
            buffer,
            labels=np.asarray(self.labels),
            mean=self.mean,
            scale=self.scale,
            coef=self.coef,
            intercept=self.intercept,
        )
        return buffer.getvalue()

    @classmethod
    def from_bytes(cls, version: str, data: bytes) -> "GenreModel":
        with np.load(io.BytesIO(data), allow_pickle=False) as npz:
            return cls(
                version=version,
                labels=[str(label) for label in npz["labels"]],
                mean=npz["mean"].astype(np.float64),
                scale=npz["scale"].astype(np.float64),
                coef=npz["coef"].astype(np.float64),
                intercept=npz["intercept"].astype(np.float64),
            )


def _validate_version(version: str) -> str:
    if not VERSION_PATTERN.match(version):
        raise ValueError(f"Invalid model version name: {version!r}")
    return version


def split_indices(labels: Sequence[str]) -> Tuple[np.ndarray, np.ndarray]:
    """Deterministic stratified split of the base dataset into train and test indices."""
    rng = np.random.default_rng(SPLIT_SEED)
    labels_arr = np.asarray(labels)
    train, test = [], []
    for label in sorted(set(labels_arr.tolist())):
        idx = np.where(labels_arr == label)[0]
        idx = idx[rng.permutation(len(idx))]
        n_test = max(1, int(round(len(idx) * TEST_FRACTION)))
        test.extend(idx[:n_test].tolist())
        train.extend(idx[n_test:].tolist())
    return np.asarray(sorted(train)), np.asarray(sorted(test))


def evaluate(model: GenreModel, features: np.ndarray, labels: Sequence[str]) -> Dict:
    """Accuracy, per-genre F1 and confusion matrix on the given samples."""
    label_list = model.labels
    index = {label: i for i, label in enumerate(label_list)}
    known = [i for i, label in enumerate(labels) if label in index]
    y_true = np.asarray([index[labels[i]] for i in known])
    y_pred = model.predict_proba(features[known]).argmax(axis=1)

    n = len(label_list)
    confusion = np.zeros((n, n), dtype=int)
    for t, p in zip(y_true, y_pred):
        confusion[t, p] += 1

    f1: Dict[str, float] = {}
    for i, label in enumerate(label_list):
        tp = confusion[i, i]
        fp = confusion[:, i].sum() - tp
        fn = confusion[i, :].sum() - tp
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1[label] = round(2 * precision * recall / (precision + recall), 4) if precision + recall else 0.0

    accuracy = float((y_true == y_pred).mean()) if len(y_true) else 0.0
    return {
        "accuracy": round(accuracy, 4),
        "macro_f1": round(float(np.mean(list(f1.values()))) if f1 else 0.0, 4),
        "f1_per_genre": f1,
        "confusion_matrix": confusion.tolist(),
        "labels": label_list,
        "test_samples": int(len(y_true)),
    }


def train_model(
    version: str,
    base_features: np.ndarray,
    base_labels: Sequence[str],
    extra_features: Optional[np.ndarray] = None,
    extra_labels: Optional[Sequence[str]] = None,
    regularization: float = 0.01,
    extra_weight: float = 2.0,
) -> Tuple[GenreModel, Dict]:
    """Trains a new version on the base train split plus optional user corrections."""
    from sklearn.linear_model import LogisticRegression

    train_idx, test_idx = split_indices(base_labels)
    labels_arr = np.asarray(base_labels)
    label_set = sorted(set(labels_arr.tolist()))

    x_train = base_features[train_idx].astype(np.float64)
    y_train = labels_arr[train_idx].tolist()
    weights = [1.0] * len(y_train)

    used_extra = 0
    if extra_features is not None and extra_labels is not None and len(extra_labels):
        keep = [i for i, label in enumerate(extra_labels) if label in label_set]
        if keep:
            x_train = np.vstack([x_train, np.asarray(extra_features, dtype=np.float64)[keep]])
            y_train += [extra_labels[i] for i in keep]
            weights += [extra_weight] * len(keep)
            used_extra = len(keep)

    mean = x_train.mean(axis=0)
    scale = x_train.std(axis=0)
    scale[scale < 1e-8] = 1.0

    clf = LogisticRegression(C=regularization, max_iter=3000)
    clf.fit((x_train - mean) / scale, y_train, sample_weight=np.asarray(weights))

    coef = clf.coef_.astype(np.float64)
    intercept = clf.intercept_.astype(np.float64)
    if coef.shape[0] == 1:
        # Binary problem: sklearn stores a single logit for the second class; softmax over
        # [0, w·x + b] is the equivalent two-class form.
        coef = np.vstack([np.zeros_like(coef), coef])
        intercept = np.concatenate([[0.0], intercept])

    model = GenreModel(
        version=version,
        labels=[str(c) for c in clf.classes_],
        mean=mean,
        scale=scale,
        coef=coef,
        intercept=intercept,
    )
    metrics = evaluate(model, base_features[test_idx].astype(np.float64), labels_arr[test_idx].tolist())
    metrics.update(
        {
            "version": version,
            "train_samples": int(len(y_train)),
            "corrections_used": used_extra,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return model, metrics


class GenreModelRegistry:
    """Loads, caches and stores genre model versions on disk."""

    def __init__(self, directory: str):
        self.directory = directory
        self._cache: Dict[str, GenreModel] = {}
        self._lock = threading.Lock()
        self._base: Optional[Tuple[np.ndarray, List[str]]] = None
        self._embedding_stats: Optional[Tuple[np.ndarray, np.ndarray]] = None

    # ── Base dataset ────────────────────────────────────────────────────────
    def base_dataset(self) -> Tuple[np.ndarray, List[str]]:
        if self._base is None:
            path = os.path.join(self.directory, BASE_DATASET_FILE)
            with np.load(path, allow_pickle=False) as npz:
                self._base = (npz["features"].astype(np.float32), [str(x) for x in npz["labels"]])
        return self._base

    def embedding_stats(self) -> Tuple[np.ndarray, np.ndarray]:
        """Mean / std of the base dataset — fixed across model versions so embeddings stay comparable."""
        if self._embedding_stats is None:
            try:
                features, _ = self.base_dataset()
                scale = features.std(axis=0)
                scale[scale < 1e-8] = 1.0
                self._embedding_stats = (features.mean(axis=0), scale)
            except FileNotFoundError:
                from app.ml.features import FEATURE_SIZE

                self._embedding_stats = (np.zeros(FEATURE_SIZE, np.float32), np.ones(FEATURE_SIZE, np.float32))
        return self._embedding_stats

    # ── Versions ────────────────────────────────────────────────────────────
    def _paths(self, version: str) -> Tuple[str, str]:
        _validate_version(version)
        return (
            os.path.join(self.directory, f"{version}.npz"),
            os.path.join(self.directory, f"{version}.json"),
        )

    def has(self, version: str) -> bool:
        return version in self._cache or os.path.exists(self._paths(version)[0])

    def get(self, version: str) -> GenreModel:
        with self._lock:
            if version not in self._cache:
                weights_path, _ = self._paths(version)
                with open(weights_path, "rb") as f:
                    self._cache[version] = GenreModel.from_bytes(version, f.read())
            return self._cache[version]

    def metrics(self, version: str) -> Optional[Dict]:
        _, metrics_path = self._paths(version)
        if not os.path.exists(metrics_path):
            return None
        with open(metrics_path, encoding="utf-8") as f:
            return json.load(f)

    def list_versions(self) -> List[str]:
        if not os.path.isdir(self.directory):
            return []
        return sorted(
            name[:-4] for name in os.listdir(self.directory) if name.endswith(".npz") and name != BASE_DATASET_FILE
        )

    def save(self, model: GenreModel, metrics: Optional[Dict]) -> None:
        weights_path, metrics_path = self._paths(model.version)
        os.makedirs(self.directory, exist_ok=True)
        with open(weights_path, "wb") as f:
            f.write(model.to_bytes())
        if metrics is not None:
            with open(metrics_path, "w", encoding="utf-8") as f:
                json.dump(metrics, f, ensure_ascii=False, indent=2)
        with self._lock:
            self._cache[model.version] = model

    def export_b64(self, version: str) -> str:
        return base64.b64encode(self.get(version).to_bytes()).decode("ascii")

    def import_b64(self, version: str, weights_b64: str, metrics: Optional[Dict] = None) -> GenreModel:
        model = GenreModel.from_bytes(version, base64.b64decode(weights_b64))
        self.save(model, metrics)
        return model

    def train(
        self,
        version: str,
        extra_features: Optional[np.ndarray] = None,
        extra_labels: Optional[Sequence[str]] = None,
        regularization: Optional[float] = None,
    ) -> Tuple[GenreModel, Dict]:
        _validate_version(version)
        features, labels = self.base_dataset()
        c = settings.GENRE_REGULARIZATION if regularization is None else regularization
        model, metrics = train_model(version, features, labels, extra_features, extra_labels, regularization=c)
        metrics["regularization"] = c
        self.save(model, metrics)
        logger.info(f"Trained genre model {version}: accuracy={metrics['accuracy']} macro_f1={metrics['macro_f1']}")
        return model, metrics


registry = GenreModelRegistry(settings.GENRE_MODEL_DIR)
