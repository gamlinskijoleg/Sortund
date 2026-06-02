import os
import sys
import time
import json
import random
import requests
from typing import List

# Конфігурація локального середовища
TARGET_DIR = r"D:\Users\Oleg\Desktop\music\files"
API_URL = "http://127.0.0.1:8000/v1/analyze-track"
LIMIT_TRACKS = 3  # Збільшено за твоїм запитом
OUTPUT_JSON_PATH = os.path.join(os.path.dirname(__file__), "pipeline_results.json")


def get_random_mp3_files(directory: str, limit: int) -> List[str]:
    """Сканує директорію та повертає шляхи до N випадкових файлів .mp3"""
    if not os.path.exists(directory):
        print(f"❌ Помилка: Вказана папка не існує: {directory}")
        sys.exit(1)

    mp3_files = []
    for file in os.listdir(directory):
        if file.lower().endswith(".mp3"):
            mp3_files.append(os.path.join(directory, file))

    if not mp3_files:
        return []

    # Безпечний вибірка унікальних треків
    sample_size = min(len(mp3_files), limit)
    return random.sample(mp3_files, sample_size)


def test_pipeline():
    """Запускає тестування локального аудіо пайплайну на випадкових треках."""
    print("=" * 60)
    print("🚀 СТАРТ ТЕСТУВАННЯ ЛОКАЛЬНОГО АУДІО ПАЙПЛАЙНУ (V1.5.0 CLEAN API)")
    print("=" * 60)
    print(f"📁 Сканування папки: {TARGET_DIR}")

    tracks = get_random_mp3_files(TARGET_DIR, LIMIT_TRACKS)

    if not tracks:
        print("⚠️ У папці не знайдено жодного файлу з розширенням .mp3")
        return

    print(f"📌 Обрано {len(tracks)} випадкових треків для тестового забігу.\n")

    total_start_time = time.perf_counter()
    successful_tracks_count = 0
    saved_results = []

    for index, track_path in enumerate(tracks, start=1):
        filename = os.path.basename(track_path)
        print(f"--- [Трек {index}/{len(tracks)}]: {filename} ---")
        print("⏳ Надсилання файлу в нейромережу...")

        track_start_time = time.perf_counter()
        track_record = {
            "index": index,
            "filename": filename,
            "status": "failed",
            "duration_sec": 0,
            "api_response": None,
        }

        try:
            with open(track_path, "rb") as audio_file:
                files = {"file": (filename, audio_file, "audio/mpeg")}
                response = requests.post(API_URL, files=files)

            track_duration = time.perf_counter() - track_start_time
            track_record["duration_sec"] = round(track_duration, 2)

            if response.status_code == 200:
                result = response.json()
                successful_tracks_count += 1

                track_record["status"] = "success"
                track_record["api_response"] = result

                # Красиво підставляємо "—" якщо поле прийшло як None
                album_display = result.get("album") or "—"
                year_display = result.get("year") or "—"

                print("✅ Успішна відповідь від API:")
                print(f"   🎵 Назва:    {result.get('title')}")
                print(f"   👤 Артист:   {result.get('artist')}")
                print(f"   💿 Альбом:   {album_display}")
                print(f"   📅 Рік:      {year_display}")
                print(f"   🔍 Джерело:  {result.get('analysis_source')}")
                print(f"   🎭 Настрій:  {result.get('mood')}")
                print(f"   🏷️ Теги:     {', '.join(result.get('tags', []))}")
                print(f"   ⏱️ Швидкість: {track_duration:.2f} сек")
            else:
                track_record["api_response"] = {
                    "error_code": response.status_code,
                    "text": response.text,
                }
                print(f"❌ Помилка API (Код {response.status_code}): {response.text}")
                print(f"   ⏱️ Час обробки до збою: {track_duration:.2f} сек")

        except requests.exceptions.ConnectionError:
            print(
                "❌ Не вдалося з'єднатися з сервером FastAPI. Перевірте, чи запущено uvicorn!"
            )
            track_record["api_response"] = {"error": "ConnectionError"}
            saved_results.append(track_record)
            break
        except Exception as e:
            print(f"❌ Непередбачувана помилка під час обробки файлу: {e}")
            track_record["api_response"] = {"error": str(e)}

        saved_results.append(track_record)
        print("-" * 60 + "\n")

    total_duration = time.perf_counter() - total_start_time

    # Записуємо чисті результати у структурований JSON
    try:
        with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(saved_results, f, ensure_ascii=False, indent=4)
        print(f"💾 Результати успішно збережено у файл: {OUTPUT_JSON_PATH}")
    except Exception as e:
        print(f"❌ Помилка при збереженні JSON-файлу: {e}")

    print("=" * 60)
    print("🏁 Тестування випадкових треків завершено!")
    if successful_tracks_count > 0:
        avg_time = total_duration / successful_tracks_count
        print(f"📊 Загальний час забігу: {total_duration:.2f} сек")
        print(f"⚡ Середня швидкість пайплайну: {avg_time:.2f} сек/трек")
    print("=" * 60)


if __name__ == "__main__":
    test_pipeline()
