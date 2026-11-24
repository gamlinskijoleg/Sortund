"""Trains a genre-model version on the base dataset and stores it in the model directory.

Usage (from apps/ai-worker):
    uv run python -m scripts.train_genre_model --version v1
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ml.genre_model import registry, split_indices, train_model  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default="v1")
    parser.add_argument("--tune", action="store_true", help="Pick the regularisation strength by validation")
    args = parser.parse_args()

    features, labels = registry.base_dataset()
    regularization = 0.01

    if args.tune:
        # Validation split carved out of the training part only — the test split stays untouched.
        train_idx, _ = split_indices(labels)
        sub_features = features[train_idx]
        sub_labels = [labels[i] for i in train_idx]
        best = (-1.0, regularization)
        for c in [0.01, 0.03, 0.1, 0.3, 1.0, 3.0]:
            _, m = train_model("tune", sub_features, sub_labels, regularization=c)
            print(f"C={c}: val accuracy={m['accuracy']} macro_f1={m['macro_f1']}")
            if m["macro_f1"] > best[0]:
                best = (m["macro_f1"], c)
        regularization = best[1]
        print(f"chosen C={regularization}")

    model, metrics = train_model(args.version, features, labels, regularization=regularization)
    metrics["regularization"] = regularization
    registry.save(model, metrics)
    printable = {k: v for k, v in metrics.items() if k != "confusion_matrix"}
    print(json.dumps(printable, indent=2))
    print("confusion matrix (rows = true, cols = predicted):", metrics["labels"])
    for label, row in zip(metrics["labels"], metrics["confusion_matrix"]):
        print(f"{label:>10} {np.asarray(row)}")


if __name__ == "__main__":
    main()
