import os
import sys
import time
import json
import random
import requests
from typing import List

# Local environment configuration
TARGET_DIR = r"D:\Users\Oleg\Desktop\music\files"
API_URL = "http://127.0.0.1:8000/v1/analyze-track"
LIMIT_TRACKS = 3  # Increased at your request
OUTPUT_JSON_PATH = os.path.join(os.path.dirname(__file__), "pipeline_results.json")


def get_random_mp3_files(directory: str, limit: int) -> List[str]:
    """Scans directory and returns paths to N random .mp3 files"""
    if not os.path.exists(directory):
        print(f"❌ Error: The specified folder does not exist: {directory}")
        sys.exit(1)

    mp3_files = []
    for file in os.listdir(directory):
        if file.lower().endswith(".mp3"):
            mp3_files.append(os.path.join(directory, file))

    if not mp3_files:
        return []

    # Safe unique tracks sampling
    sample_size = min(len(mp3_files), limit)
    return random.sample(mp3_files, sample_size)


def test_pipeline():
    """Starts testing the local audio pipeline on random tracks."""
    print("=" * 60)
    print("🚀 START LOCAL AUDIO PIPELINE TESTING (V1.5.0 CLEAN API)")
    print("=" * 60)
    print(f"📁 Scanning folder: {TARGET_DIR}")

    tracks = get_random_mp3_files(TARGET_DIR, LIMIT_TRACKS)

    if not tracks:
        print("⚠️ No .mp3 files found in the folder")
        return

    print(f"📌 Selected {len(tracks)} random tracks for the test run.\n")

    total_start_time = time.perf_counter()
    successful_tracks_count = 0
    saved_results = []

    for index, track_path in enumerate(tracks, start=1):
        filename = os.path.basename(track_path)
        print(f"--- [Track {index}/{len(tracks)}]: {filename} ---")
        print("⏳ Sending file to neural network...")

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

                # Nicely insert "—" if the field came as None
                album_display = result.get("album") or "—"
                year_display = result.get("year") or "—"

                print("✅ Successful API response:")
                print(f"   🎵 Title:    {result.get('title')}")
                print(f"   👤 Artist:   {result.get('artist')}")
                print(f"   💿 Album:    {album_display}")
                print(f"   📅 Year:     {year_display}")
                print(f"   🔍 Source:   {result.get('analysis_source')}")
                print(f"   🎭 Mood:     {result.get('mood')}")
                print(f"   🏷️ Tags:     {', '.join(result.get('tags', []))}")
                print(f"   ⏱️ Speed:     {track_duration:.2f} sec")
            else:
                track_record["api_response"] = {
                    "error_code": response.status_code,
                    "text": response.text,
                }
                print(f"❌ API Error (Code {response.status_code}): {response.text}")
                print(f"   ⏱️ Processing time before failure: {track_duration:.2f} sec")

        except requests.exceptions.ConnectionError:
            print(
                "❌ Failed to connect to FastAPI server. Check if uvicorn is running!"
            )
            track_record["api_response"] = {"error": "ConnectionError"}
            saved_results.append(track_record)
            break
        except Exception as e:
            print(f"❌ Unexpected error during file processing: {e}")
            track_record["api_response"] = {"error": str(e)}

        saved_results.append(track_record)
        print("-" * 60 + "\n")

    total_duration = time.perf_counter() - total_start_time

    # Writing clean results to structured JSON
    try:
        with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(saved_results, f, ensure_ascii=False, indent=4)
        print(f"💾 Results successfully saved to file: {OUTPUT_JSON_PATH}")
    except Exception as e:
        print(f"❌ Error saving JSON file: {e}")

    print("=" * 60)
    print("🏁 Random track testing completed!")
    if successful_tracks_count > 0:
        avg_time = total_duration / successful_tracks_count
        print(f"📊 Total run time: {total_duration:.2f} sec")
        print(f"⚡ Average pipeline speed: {avg_time:.2f} sec/track")
    print("=" * 60)


if __name__ == "__main__":
    test_pipeline()
