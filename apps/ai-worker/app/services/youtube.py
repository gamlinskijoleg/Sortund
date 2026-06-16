import asyncio
import logging
import difflib
from ytmusicapi import YTMusic
from typing import List, Optional
from typing_extensions import TypedDict

logger = logging.getLogger("sortund-ai-pipeline")
yt_music_client = YTMusic()


class YTMetadata(TypedDict):
    extra_info: List[str]
    source: str
    title: str
    artist: str
    year: Optional[int]


async def fetch_and_validate_youtube_metadata(
    artist: str, title: str, source_analysis: str, original_filename: str
) -> YTMetadata:
    """Шукає трек на YouTube Music і валідує відповідність, щоб захистити локальні релізи."""
    enrichment: YTMetadata = {
        "extra_info": [],
        "source": source_analysis,
        "title": title,
        "artist": artist,
        "year": None,
    }

    try:
        search_query = f"{artist} - {title}" if artist != "Unknown Artist" else title
        yt_search = await asyncio.to_thread(
            yt_music_client.search, search_query, filter="songs"
        )

        if yt_search:
            top_hit = yt_search[0]
            found_title = top_hit.get("title", "")
            found_artist = (
                top_hit["artists"][0].get("name", "")
                if top_hit.get("artists")
                else "Unknown Artist"
            )

            # --- 🛡️ СУВОРРИЙ ЗАХИСТ АНДЕРГРАУНДУ (Кейс Schmalgauzen) ---
            # Перевіряємо, чи є в оригінальному файлі маркери специфічних локальних треків
            fn_lower = original_filename.lower()
            is_special_local = any(
                m in fn_lower
                for m in [
                    "cover",
                    "українською",
                    "ukr",
                    "ua",
                    "шмальцгаузен",
                    "schmalgauzen",
                ]
            )

            # Розрахунок схожості назв (Fuzzy Matching)
            similarity = difflib.SequenceMatcher(
                None, title.lower(), found_title.lower()
            ).ratio()

            if (
                source_analysis == "Filename Local Parser"
                and artist == "Unknown Artist"
            ):
                # Якщо пошуковик знайшов зовсім іншого виконавця на ультра-короткий запит (наприклад, "уночі")
                # і назва має маркери каверу/інді, або збіг за тайтлом слабкий — БЛОКУЄМО автозаміну артиста!
                if (
                    is_special_local
                    and found_artist.lower() != "schmalgauzen"
                    and found_artist.lower() != "shmalgauzen"
                ):
                    logger.info(
                        f"🛡️ Валідатор заблокував автозаміну для '{title}': знайдено поп-трек від {found_artist}"
                    )
                    # Залишаємо оригінальні дані парсера, не пускаючи попсу
                elif len(title) <= 5 and similarity < 0.9:
                    logger.info(
                        f"🛡️ Запит занадто короткий ({title}), низький збіг. Результат YouTube ігнорується."
                    )
                else:
                    # Безпечний імпорт метаданих
                    enrichment["title"] = found_title
                    enrichment["artist"] = found_artist
                    enrichment["source"] = "YouTube Music Search Engine"

            # Збір додаткових метаданих

            album_name = (
                top_hit.get("album", {}).get("name", "") if top_hit.get("album") else ""
            )
            if album_name:
                enrichment["extra_info"].append(f"Album: {album_name}")

    except Exception as e:
        logger.warning(f"⚠️ Не вдалося збагатити метадані з YouTube: {e}")

    return enrichment
