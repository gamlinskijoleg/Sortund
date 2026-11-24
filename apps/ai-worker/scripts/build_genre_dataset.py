"""Builds the feature dataset for the genre classifier from a GTZAN-style folder.

Usage (from apps/ai-worker):
    uv run python -m scripts.build_genre_dataset --source data/genres --out app/ml/genre_models/base_dataset.npz

The source folder must contain one sub-folder per genre with audio files inside
(GTZAN: https://huggingface.co/datasets/marsyas/gtzan).
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import List, Optional, Tuple

import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

AUDIO_EXTENSIONS = (".wav", ".mp3", ".flac", ".ogg", ".m4a", ".au")

_session = None


def _init_worker(model_path: str) -> None:
    global _session
    import onnxruntime as ort

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    opts.inter_op_num_threads = 1
    _session = ort.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])


def _extract(path: str) -> Optional[np.ndarray]:
    from app.ml.features import ast_input_from_waveform, build_feature_vector, compute_dsp, load_audio
    from app.ml.features import split_ast_windows

    try:
        y = load_audio(path)
        windows = np.stack([ast_input_from_waveform(w) for w in split_ast_windows(y)])
        logits = _session.run(None, {"input_values": windows})[0]
        probs = (1 / (1 + np.exp(-logits))).mean(axis=0)
        return build_feature_vector(probs, compute_dsp(y))
    except Exception as e:  # corrupted files exist in GTZAN (e.g. jazz.00054)
        print(f"skip {path}: {e}", flush=True)
        return None


def collect_files(source: str) -> List[Tuple[str, str]]:
    items = []
    for genre in sorted(os.listdir(source)):
        folder = os.path.join(source, genre)
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if name.lower().endswith(AUDIO_EXTENSIONS):
                items.append((os.path.join(folder, name), genre))
    return items


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="data/genres")
    parser.add_argument("--out", default="app/ml/genre_models/base_dataset.npz")
    parser.add_argument("--model", default="app/ml/model/audio_tagger/model.onnx")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    files = collect_files(args.source)
    print(f"{len(files)} files found", flush=True)
    features, labels, names = [], [], []
    started = time.time()

    with ProcessPoolExecutor(max_workers=args.workers, initializer=_init_worker, initargs=(args.model,)) as pool:
        futures = {pool.submit(_extract, path): (path, genre) for path, genre in files}
        for done, future in enumerate(as_completed(futures), start=1):
            path, genre = futures[future]
            vector = future.result()
            if vector is not None:
                features.append(vector)
                labels.append(genre)
                names.append(os.path.basename(path))
            if done % 50 == 0:
                print(f"{done}/{len(files)} in {time.time() - started:.0f}s", flush=True)

    order = np.argsort(names)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    np.savez_compressed(
        args.out,
        features=np.asarray(features, dtype=np.float32)[order],
        labels=np.asarray(labels)[order],
        names=np.asarray(names)[order],
    )
    print(f"saved {len(features)} samples to {args.out} in {time.time() - started:.0f}s", flush=True)


if __name__ == "__main__":
    main()
