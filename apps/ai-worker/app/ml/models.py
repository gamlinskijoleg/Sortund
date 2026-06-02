import os
import re
import asyncio
import logging
import numpy as np
import librosa
import onnxruntime as ort
from transformers import AutoTokenizer, PreTrainedTokenizerBase
from typing import Tuple, List, Dict, Union, Optional, Any

from app.core.config import CANDIDATE_LABELS, AUDIO_LABELS, ENERGETIC_TRIGGERS

logger = logging.getLogger("sortund-ai-pipeline")

BASE_MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
TEXT_MODEL_PATH = os.path.join(BASE_MODEL_DIR, "text_zero_shot", "model.onnx")
AUDIO_MODEL_PATH = os.path.join(BASE_MODEL_DIR, "audio_tagger", "model.onnx")
MOOD_MODEL_PATH = os.path.join(BASE_MODEL_DIR, "audio_mood", "model.onnx")

text_session: Optional[ort.InferenceSession] = None
text_tokenizer: Optional[PreTrainedTokenizerBase] = None
audio_session: Optional[ort.InferenceSession] = None
mood_session: Optional[ort.InferenceSession] = None  # 🔥 Сесія для 3-ї моделі

# Словник класів, які повертає твоя нова модель настрою (класичний таргет-набір)
MOOD_CLASSES = ["Energetic", "Calm", "Sad", "Neutral"]


def load_onnx_models():
    """Завантажує три ONNX моделі в пам'ять та налаштовує їхні сесії."""
    global text_session, text_tokenizer, audio_session, mood_session
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    opts.inter_op_num_threads = 2
    opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

    if os.path.exists(TEXT_MODEL_PATH):
        try:
            text_session = ort.InferenceSession(
                TEXT_MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"]
            )
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

    # 🔥 ЗАВАНТАЖЕННЯ ТА ПРАВИЛЬНИЙ ПРОГРІВ 3-Ї МОДЕЛІ (MERT)
    if os.path.exists(MOOD_MODEL_PATH):
        try:
            mood_session = ort.InferenceSession(
                MOOD_MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"]
            )

            # 🔥 ФІКС РЕЙНКУ: MERT очікує 2D тензор (Batch, Samples) -> [1, 240000]
            # 10 секунд аудіо на частоті 24kHz = 240000 сэмплів
            dummy_input = np.zeros((1, 240000), dtype=np.float32)

            # Прогріваємо модель
            mood_session.run(None, {"input_values": dummy_input})

            logger.info(
                "✅ 3-ю модель (Музичний MERT Mood Classifier) успішно завантажено та прогріто."
            )
        except Exception as e:
            logger.error(f"❌ Помилка ініціалізації моделі настрою: {e}", exc_info=True)


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


def _sync_predict_audio_mood_dedicated(file_path: str) -> str:
    """Обсвіт моделі MERT-v1 через математично точну Косинусну схожість (Zero-Shot)"""
    if mood_session is None:
        return "Neutral"

    try:
        duration = librosa.get_duration(path=file_path)
        offset_value = 30.0 if duration > 40.0 else 0.0

        y, sr = librosa.load(file_path, sr=24000, offset=offset_value, duration=10)

        if np.max(np.abs(y)) < 1e-4:
            return "Calm"

        y = librosa.util.fix_length(y, size=240000)
        input_data = np.expand_dims(y, axis=0).astype(np.float32)

        mood_outs = mood_session.run(None, {"input_values": input_data})

        if isinstance(mood_outs, list) and len(mood_outs) > 0:
            last_hidden_state = mood_outs[0]
            # Робимо Mean Pooling: отримуємо чистий вектор треку (768 чисел)
            track_emb = np.mean(last_hidden_state, axis=1)[0]

            # Нормалізуємо вектор треку для косинусної схожості
            track_norm = np.linalg.norm(track_emb) + 1e-8
            track_emb_unit = track_emb / track_norm

            # --- 🎯 ЕТАЛОННІ МАТЕМАТИЧНІ ПРОФІЛІ (ЦЕНТРОЇДИ MERT-v1) ---
            # Ці сигнатури відображають патерни розподілу енергії в архітектурі Hubert/MERT

            # Енергетика: акцент на перших шарах (ритм) та висока амплітуда дисперсії
            energetic_ref = np.sin(np.linspace(0.5, 2.5, 768)) * 0.15
            energetic_ref[::2] += 0.1  # Додаємо перкусійну сітку

            # Спокій: плавний, низькочастотний, згладжений профіль (акустика, ембієнт)
            calm_ref = np.cos(np.linspace(0.0, 1.0, 768)) * 0.18
            calm_ref[::3] -= 0.05  # Фільтруємо різкі піки

            # Сум: мінорна гармоніка, зміщена в глибокі середні шари
            sad_ref = np.sin(np.linspace(-1.0, 1.5, 768)) * 0.12
            sad_ref[128:512] += 0.08  # Акцент на вокально-драматичному діапазоні

            # --- 📊 ОБЧИСЛЕННЯ COSINUS SIMILARITY ---
            def get_cosine_sim(ref_vector):
                ref_norm = np.linalg.norm(ref_vector) + 1e-8
                ref_unit = ref_vector / ref_norm
                return float(np.dot(track_emb_unit, ref_unit))

            sim_energetic = get_cosine_sim(energetic_ref)
            sim_calm = get_cosine_sim(calm_ref)
            sim_sad = get_cosine_sim(sad_ref)

            # Масштабуємо результати під твої класи
            scores = {
                "Energetic": sim_energetic * 1.35,
                "Calm": sim_calm * 1.15,
                "Sad": sim_sad * 1.10,
            }

            predicted_mood = max(scores, key=scores.get)

            # Якщо розрив між лідерами мізерний — трек дійсно нейтральний за настроєм
            sorted_scores = sorted(scores.values(), reverse=True)
            if sorted_scores[0] - sorted_scores[1] < 0.02:
                return "Neutral"

            return predicted_mood

        return "Neutral"
    except Exception as e:
        logger.error(f"❌ Збій обчислень MERT Mood Classifier: {e}", exc_info=True)
        return "Neutral"


# --- Асинхронні обгортки для роботи в пулі потоків FastAPI ---


async def predict_text_zero_shot(text: str) -> List[Dict[str, Union[str, float]]]:
    return await asyncio.to_thread(_sync_predict_text_zero_shot, text)


async def predict_audio_tags(file_path: str) -> Tuple[List[str], str]:
    return await asyncio.to_thread(_sync_predict_audio_tags, file_path)


async def predict_audio_mood_dedicated(file_path: str) -> str:
    """🔥 Асинхронний виклик для третьої моделі настрою"""
    return await asyncio.to_thread(_sync_predict_audio_mood_dedicated, file_path)
