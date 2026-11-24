"""ONNX model sessions: AST audio tagger (AudioSet, 527 classes) and an NLI model for zero-shot text tagging."""

import logging
import os
import re
from typing import Any, Dict, List, Optional

import numpy as np
import onnxruntime as ort
from huggingface_hub import snapshot_download
from transformers import AutoTokenizer, PreTrainedTokenizerBase

from app.core.settings import settings
from app.ml.features import NUM_AUDIOSET_CLASSES, ast_input_from_waveform, split_ast_windows

logger = logging.getLogger("sortund-ai-pipeline")

BASE_MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
TEXT_MODEL_PATH = os.path.join(BASE_MODEL_DIR, "text_zero_shot", "model.onnx")
AUDIO_MODEL_PATH = os.path.join(BASE_MODEL_DIR, "audio_tagger", "model.onnx")

text_session: Optional[ort.InferenceSession] = None
text_tokenizer: Optional[PreTrainedTokenizerBase] = None
audio_session: Optional[ort.InferenceSession] = None

# Index of the "contradiction" and "entailment" logits of the MNLI head.
_CONTRADICTION = 0
_ENTAILMENT = 2
_VERSION_SUFFIX_RE = re.compile(
    r"[\(\[][^\)\]]*(?:version|remix|edit|mix|master|feat|ft)[^\)\]]*[\)\]]",
    flags=re.IGNORECASE,
)


def load_onnx_models() -> None:
    """Loads ONNX models into memory. If files are missing, downloads them from the HF Model Hub."""
    global text_session, text_tokenizer, audio_session, TEXT_MODEL_PATH, AUDIO_MODEL_PATH

    if not os.path.exists(TEXT_MODEL_PATH) or not os.path.exists(AUDIO_MODEL_PATH):
        logger.info("Local models not found. Starting download from Hugging Face Model Hub...")
        try:
            downloaded_dir = snapshot_download(repo_id="gamlinskijoleg/sortund-models", token=settings.HF_TOKEN or None)
            TEXT_MODEL_PATH = os.path.join(downloaded_dir, "text_zero_shot", "model.onnx")
            AUDIO_MODEL_PATH = os.path.join(downloaded_dir, "audio_tagger", "model.onnx")
            logger.info(f"Models successfully loaded into cache: {downloaded_dir}")
        except Exception as e:
            logger.error(f"Failed to download models from Hugging Face Hub: {e}", exc_info=True)
            return

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    opts.inter_op_num_threads = 2
    opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

    if os.path.exists(TEXT_MODEL_PATH):
        try:
            text_session = ort.InferenceSession(TEXT_MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"])
            text_tokenizer = AutoTokenizer.from_pretrained(os.path.dirname(TEXT_MODEL_PATH))
            logger.info("Text zero-shot ONNX successfully loaded.")
        except Exception as e:
            logger.error(f"Error initializing text model: {e}", exc_info=True)

    if os.path.exists(AUDIO_MODEL_PATH):
        try:
            audio_session = ort.InferenceSession(
                AUDIO_MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"]
            )
            logger.info("Audio AST ONNX successfully loaded.")
        except Exception as e:
            logger.error(f"Error initializing audio model: {e}", exc_info=True)


def audioset_probabilities(y: np.ndarray) -> np.ndarray:
    """AudioSet class probabilities averaged over up to three 10-second windows of ``y``."""
    if audio_session is None or y.size == 0:
        return np.zeros(NUM_AUDIOSET_CLASSES, dtype=np.float32)
    batch = np.stack([ast_input_from_waveform(w) for w in split_ast_windows(y)])
    outputs: Any = audio_session.run(None, {"input_values": batch})
    logits = np.asarray(outputs[0], dtype=np.float32)
    return (1.0 / (1.0 + np.exp(-logits))).mean(axis=0).astype(np.float32)


def clean_text_for_zero_shot(text: str) -> str:
    return " ".join(_VERSION_SUFFIX_RE.sub("", text).split()).strip()


def zero_shot(
    premise: str,
    hypotheses: Dict[str, str],
    template: str = "This music is {}.",
    max_length: int = 256,
) -> Dict[str, float]:
    """Multi-label zero-shot classification: entailment probability (0..1) for every hypothesis."""
    if text_session is None or text_tokenizer is None or not premise.strip() or not hypotheses:
        return {}

    labels = list(hypotheses.keys())
    try:
        inputs = text_tokenizer(
            [premise] * len(labels),
            [template.format(hypotheses[label]) for label in labels],
            return_tensors="np",
            truncation="only_first",
            padding=True,
            max_length=max_length,
        )
        feed = {
            "input_ids": np.asarray(inputs["input_ids"], dtype=np.int64),
            "attention_mask": np.asarray(inputs["attention_mask"], dtype=np.int64),
        }
        outputs: Any = text_session.run(None, feed)
        logits = np.asarray(outputs[0], dtype=np.float64)
        pair = logits[:, [_CONTRADICTION, _ENTAILMENT]]
        pair -= pair.max(axis=1, keepdims=True)
        probs = np.exp(pair)
        probs /= probs.sum(axis=1, keepdims=True)
        return {label: float(probs[i, 1]) for i, label in enumerate(labels)}
    except Exception as e:
        logger.error(f"Zero-shot text classification failure: {e}")
        return {}


def zero_shot_single_label(
    premise: str, hypotheses: Dict[str, str], template: str = "This music is {}."
) -> Dict[str, float]:
    """Single-label variant: entailment logits normalised with softmax across all hypotheses."""
    multi = zero_shot(premise, hypotheses, template)
    if not multi:
        return {}
    values = np.asarray(list(multi.values()))
    logits = np.log(np.clip(values, 1e-6, 1.0))
    exp = np.exp(logits - logits.max())
    exp /= exp.sum()
    return {label: float(p) for label, p in zip(multi.keys(), exp)}


def top_labels(probs: Dict[str, float], limit: int) -> List[str]:
    return [k for k, _ in sorted(probs.items(), key=lambda kv: kv[1], reverse=True)[:limit]]
