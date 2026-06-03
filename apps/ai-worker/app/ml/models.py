import os
import re
import asyncio
import logging
import numpy as np
import librosa
import onnxruntime as ort
from transformers import AutoTokenizer, PreTrainedTokenizerBase
from typing import Tuple, List, Dict, Union, Optional, Any
from huggingface_hub import snapshot_download  # <--- Додали імпорт

from app.core.config import CANDIDATE_LABELS, AUDIO_LABELS, ENERGETIC_TRIGGERS

logger = logging.getLogger("sortund-ai-pipeline")

BASE_MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
TEXT_MODEL_PATH = os.path.join(BASE_MODEL_DIR, "text_zero_shot", "model.onnx")
AUDIO_MODEL_PATH = os.path.join(BASE_MODEL_DIR, "audio_tagger", "model.onnx")

text_session: Optional[ort.InferenceSession] = None
text_tokenizer: Optional[PreTrainedTokenizerBase] = None
audio_session: Optional[ort.InferenceSession] = None


def load_onnx_models():
    """Завантажує ONNX моделі в пам'ять. Якщо файлів немає, стягує їх з HF Model Hub."""
    global text_session, text_tokenizer, audio_session, TEXT_MODEL_PATH, AUDIO_MODEL_PATH

    # 1. ПЕРЕВІРКА: Якщо локальних файлів немає, качаємо з Hugging Face
    if not os.path.exists(TEXT_MODEL_PATH) or not os.path.exists(AUDIO_MODEL_PATH):
        logger.info(
            "⚠️ Локальних моделей не знайдено. Починаю завантаження з Hugging Face Model Hub..."
        )
        try:
            # Стягуємо токен із секретів (на HF Spaces він підтягнеться автоматично, якщо доданий в Settings)
            hf_token = os.getenv("HF_TOKEN")

            # Завантажуємо весь репозиторій моделей у системний кеш
            downloaded_dir = snapshot_download(
                repo_id="gamlinskijoleg/sortund-models", token=hf_token
            )

            # Перепризначаємо шляхи на завантажені файли
            TEXT_MODEL_PATH = os.path.join(
                downloaded_dir, "text_zero_shot", "model.onnx"
            )
            AUDIO_MODEL_PATH = os.path.join(
                downloaded_dir, "audio_tagger", "model.onnx"
            )
            logger.info(f"✅ Моделі успішно завантажено у кеш: {downloaded_dir}")
        except Exception as e:
            logger.error(
                f"❌ Не вдалося завантажити моделі з Hugging Face Hub: {e}",
                exc_info=True,
            )
            return

    # 2. ІНІЦІАЛІЗАЦІЯ СЕСІЙ (Твій оригінальний код, але з новими шляхами)
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    opts.inter_op_num_threads = 2
    opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

    if os.path.exists(TEXT_MODEL_PATH):
        try:
            text_session = ort.InferenceSession(
                TEXT_MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"]
            )
            # Токенізер шукаємо в тій же папці, де лежить ONNX модель
            text_tokenizer = AutoTokenizer.from_pretrained(
                os.path.dirname(TEXT_MODEL_PATH)
            )
            logger.info("✅ Текстовий Zero-Shot ONNX завантажено успішно.")
        except Exception as e:
            logger.error(
                f"❌ Помилка ініціалізації текстової моделі: {e}", exc_info=True
            )

    if os.path.exists(AUDIO_MODEL_PATH):
        try:
            audio_session = ort.InferenceSession(
                AUDIO_MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"]
            )
            logger.info("✅ Аудіо AST ONNX завантажено успішно.")
        except Exception as e:
            logger.error(f"❌ Помилка ініціалізації аудіо моделі: {e}", exc_info=True)


def _sync_predict_text_zero_shot(text: str) -> List[Dict[str, Union[str, float]]]:
    """Синхронно передбачає текстові теги за допомогою моделі zero-shot."""
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
                "input_ids": np.array(inputs["input_ids"], dtype=np.int64),
                "attention_mask": np.array(inputs["attention_mask"], dtype=np.int64),
            }
            ort_outs = text_session.run(None, input_feed)
            if isinstance(ort_outs, list):
                out_0: Any = ort_outs[0]
                logits = out_0[0]
                relevant_logits = np.array([logits[0], logits[2]])
                probs = np.exp(relevant_logits - np.max(relevant_logits))
                probs /= probs.sum()
                entail_prob = float(probs[1]) * 100

                if entail_prob > 85.0:
                    raw_results.append({"label": label, "prob": entail_prob})
    except Exception as e:
        logger.error(f"❌ Збій обчислень Text Zero-Shot: {e}")
    return raw_results


def _sync_predict_audio_tags(file_path: str) -> Tuple[List[str], str]:
    """Синхронно аналізує аудіофайл та визначає аудіо теги і дефолтний настрій (як fallback)."""
    if audio_session is None:
        return [], "Unknown"

    try:
        duration = librosa.get_duration(path=file_path)
        offset_value = 30.0 if duration > 40.0 else 0.0

        y, sr = librosa.load(file_path, sr=16000, offset=offset_value, duration=10)
        if np.max(np.abs(y)) < 1e-4:
            return [], "Calm"

        stft = np.abs(
            librosa.stft(
                y, n_fft=400, hop_length=160, win_length=400, window="hann", center=True
            )
        )
        mel_basis = librosa.filters.mel(
            sr=16000, n_fft=400, n_mels=128, fmin=0, fmax=8000
        )
        mel = np.dot(mel_basis, stft)
        log_mel = np.log(mel + 1e-7)
        log_mel = librosa.util.fix_length(log_mel, size=1024, axis=1)

        normalized_mel = (log_mel.T - (-4.268)) / 4.569
        input_data = np.expand_dims(normalized_mel, axis=0).astype(np.float32)

        audio_outs = audio_session.run(None, {"input_values": input_data})
        if isinstance(audio_outs, list):
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
            for g in ["Guitar", "Electric guitar", "Acoustic guitar"]
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

        return detected_audio_tags, primary_mood
    except Exception as e:
        logger.error(f"❌ Збій обчислень Audio AST Engine: {e}")
        return [], "Unknown"


async def predict_text_zero_shot(text: str) -> List[Dict[str, Union[str, float]]]:
    return await asyncio.to_thread(_sync_predict_text_zero_shot, text)


async def predict_audio_tags(file_path: str) -> Tuple[List[str], str]:
    return await asyncio.to_thread(_sync_predict_audio_tags, file_path)
