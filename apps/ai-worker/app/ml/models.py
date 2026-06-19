import os
import re
import asyncio
import logging
import numpy as np
import librosa
import onnxruntime as ort
from transformers import (
    AutoTokenizer,
    PreTrainedTokenizerBase,
)
from typing import (
    Tuple,
    List,
    Dict,
    Union,
    Optional,
    Any,
)
from huggingface_hub import (
    snapshot_download,
)

from app.core.settings import (
    settings,
)
from app.core.constants import (
    CANDIDATE_LABELS,
    AUDIO_LABELS,
    ENERGETIC_TRIGGERS,
)

logger = logging.getLogger("sortund-ai-pipeline")

BASE_MODEL_DIR = os.path.join(
    os.path.dirname(__file__),
    "model",
)
TEXT_MODEL_PATH = os.path.join(
    BASE_MODEL_DIR,
    "text_zero_shot",
    "model.onnx",
)
AUDIO_MODEL_PATH = os.path.join(
    BASE_MODEL_DIR,
    "audio_tagger",
    "model.onnx",
)

text_session: Optional[ort.InferenceSession] = None
text_tokenizer: Optional[PreTrainedTokenizerBase] = None
audio_session: Optional[ort.InferenceSession] = None


def load_onnx_models():
    """Loads ONNX models into memory. If files are missing, downloads them from HF Model Hub."""
    global text_session, text_tokenizer, audio_session, TEXT_MODEL_PATH, AUDIO_MODEL_PATH

    # 1. CHECK: If local files are missing, download from Hugging Face
    if not os.path.exists(TEXT_MODEL_PATH) or not os.path.exists(AUDIO_MODEL_PATH):
        logger.info("⚠️ Local models not found. Starting download from Hugging Face Model Hub...")
        try:
            hf_token = settings.HF_TOKEN

            # Download the entire model repository to system cache
            downloaded_dir = snapshot_download(
                repo_id="gamlinskijoleg/sortund-models",
                token=hf_token,
            )

            # Reassign paths to downloaded files
            TEXT_MODEL_PATH = os.path.join(
                downloaded_dir,
                "text_zero_shot",
                "model.onnx",
            )
            AUDIO_MODEL_PATH = os.path.join(
                downloaded_dir,
                "audio_tagger",
                "model.onnx",
            )
            logger.info(f"✅ Models successfully loaded into cache: {downloaded_dir}")
        except Exception as e:
            logger.error(
                f"❌ Failed to download models from Hugging Face Hub: {e}",
                exc_info=True,
            )
            return

    # 2. SESSION INITIALIZATION (Original code, but with new paths)
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    opts.inter_op_num_threads = 2
    opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

    if os.path.exists(TEXT_MODEL_PATH):
        try:
            text_session = ort.InferenceSession(
                TEXT_MODEL_PATH,
                sess_options=opts,
                providers=["CPUExecutionProvider"],
            )
            # Tokenizer is expected in the same folder as the ONNX model
            text_tokenizer = AutoTokenizer.from_pretrained(os.path.dirname(TEXT_MODEL_PATH))
            logger.info("✅ Text Zero-Shot ONNX successfully loaded.")
        except Exception as e:
            logger.error(
                f"❌ Error initializing text model: {e}",
                exc_info=True,
            )

    if os.path.exists(AUDIO_MODEL_PATH):
        try:
            audio_session = ort.InferenceSession(
                AUDIO_MODEL_PATH,
                sess_options=opts,
                providers=["CPUExecutionProvider"],
            )
            logger.info("✅ Audio AST ONNX successfully loaded.")
        except Exception as e:
            logger.error(
                f"❌ Error initializing audio model: {e}",
                exc_info=True,
            )


def _sync_predict_text_zero_shot(
    text: str,
) -> List[
    Dict[
        str,
        Union[
            str,
            float,
        ],
    ]
]:
    """Synchronously predicts text tags using zero-shot model."""
    if text_session is None or text_tokenizer is None:
        return []

    clean_text = re.sub(
        r"[\(\]][^\)\]]*(?:version|remix|edit|mix|master|feat|ft)[^\)\]]*[\)\]]",
        "",
        text,
        flags=re.IGNORECASE,
    )
    clean_text = " ".join(clean_text.split()).strip()
    raw_results = []

    try:
        for label in CANDIDATE_LABELS:
            inputs = text_tokenizer(
                clean_text,
                f"This music is {label}.",
                return_tensors="np",
                truncation=True,
                max_length=128,
            )
            input_feed = {
                "input_ids": np.array(
                    inputs["input_ids"],
                    dtype=np.int64,
                ),
                "attention_mask": np.array(
                    inputs["attention_mask"],
                    dtype=np.int64,
                ),
            }
            ort_outs = text_session.run(
                None,
                input_feed,
            )
            if isinstance(
                ort_outs,
                list,
            ):
                out_0: Any = ort_outs[0]
                logits = out_0[0]
                relevant_logits = np.array(
                    [
                        logits[0],
                        logits[2],
                    ]
                )
                probs = np.exp(relevant_logits - np.max(relevant_logits))
                probs /= probs.sum()
                entail_prob = float(probs[1]) * 100

                if entail_prob > 85.0:
                    raw_results.append(
                        {
                            "label": label,
                            "prob": entail_prob,
                        }
                    )
    except Exception as e:
        logger.error(f"❌ Text Zero-Shot calculation failure: {e}")
    return raw_results


def _sync_predict_audio_tags(
    file_path: str,
) -> Tuple[
    List[str],
    str,
]:
    """Synchronously analyzes audio file and determines audio tags and default mood (as fallback)."""
    if audio_session is None:
        return (
            [],
            "Unknown",
        )

    try:
        # Since the frontend already trims the audio, we process it from the beginning
        (
            y,
            sr,
        ) = librosa.load(
            file_path,
            sr=16000,
            offset=0.0,
            duration=10,
        )
        if y.size == 0:
            logger.warning(f"⚠️ Audio file loaded as an empty array. Skipping processing.")
            return (
                [],
                "Unknown",
            )
        if np.max(np.abs(y)) < 1e-4:
            return (
                [],
                "Calm",
            )

        stft = np.abs(
            librosa.stft(
                y,
                n_fft=400,
                hop_length=160,
                win_length=400,
                window="hann",
                center=True,
            )
        )
        mel_basis = librosa.filters.mel(
            sr=16000,
            n_fft=400,
            n_mels=128,
            fmin=0,
            fmax=8000,
        )
        mel = np.dot(
            mel_basis,
            stft,
        )
        log_mel = np.log(mel + 1e-7)
        log_mel = librosa.util.fix_length(
            log_mel,
            size=1024,
            axis=1,
        )

        normalized_mel = (log_mel.T - (-4.268)) / 4.569
        input_data = np.expand_dims(
            normalized_mel,
            axis=0,
        ).astype(np.float32)

        audio_outs = audio_session.run(
            None,
            {"input_values": input_data},
        )
        if isinstance(
            audio_outs,
            list,
        ):
            out_0: Any = audio_outs[0]
            logits = out_0[0]
            probabilities = 1 / (1 + np.exp(-logits))
            top_indices = np.argsort(probabilities)[::-1][:15]

            detected_audio_tags = []
            for idx in top_indices:
                prob = float(probabilities[idx]) * 100
                if idx in AUDIO_LABELS and prob > 8.0:
                    tag_name = AUDIO_LABELS[idx]
                    if tag_name not in detected_audio_tags:
                        detected_audio_tags.append(tag_name)

        if any(
            g in detected_audio_tags
            for g in [
                "Guitar",
                "Electric guitar",
                "Acoustic guitar",
            ]
        ):
            if "Plucked string instrument" in detected_audio_tags:
                detected_audio_tags.remove("Plucked string instrument")
        if len(detected_audio_tags) > 1 and "Musical instrument" in detected_audio_tags:
            detected_audio_tags.remove("Musical instrument")

        primary_mood = "Neutral"
        if any(trig in detected_audio_tags for trig in ENERGETIC_TRIGGERS):
            primary_mood = "Energetic"
        elif "Piano" in detected_audio_tags or "Acoustic guitar" in detected_audio_tags:
            primary_mood = "Calm"

        return (
            detected_audio_tags,
            primary_mood,
        )
    except Exception as e:
        logger.error(f"❌ Audio AST Engine computation failure: {e}")
        return (
            [],
            "Unknown",
        )


async def predict_text_zero_shot(
    text: str,
) -> List[
    Dict[
        str,
        Union[
            str,
            float,
        ],
    ]
]:
    return await asyncio.to_thread(
        _sync_predict_text_zero_shot,
        text,
    )


async def predict_audio_tags(
    file_path: str,
) -> Tuple[
    List[str],
    str,
]:
    return await asyncio.to_thread(
        _sync_predict_audio_tags,
        file_path,
    )
