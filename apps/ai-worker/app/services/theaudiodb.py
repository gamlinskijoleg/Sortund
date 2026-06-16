import logging
import asyncio
import aiohttp
import re
from typing import Optional

logger = logging.getLogger("sortund-ai-pipeline")

async def fetch_release_year_from_theaudiodb(artist: str, title: str) -> Optional[int]:
    """Шукає рік релізу треку за допомогою TheAudioDB API."""
    if artist == "Unknown Artist":
        return None

    # Clean the title: remove anything in parentheses or brackets, and extra spaces
    clean_title = re.sub(r"\(.*?\)|\[.*?\]", "", title).strip()
    clean_title = clean_title.split(" - ")[0].strip()
    
    if not clean_title:
        clean_title = title

    try:
        async with aiohttp.ClientSession() as session:
            # 1. Search for the track
            search_url = f"https://www.theaudiodb.com/api/v1/json/2/searchtrack.php?s={artist}&t={clean_title}"
            async with session.get(search_url) as track_res:
                if track_res.status != 200:
                    return None
                
                track_data = await track_res.json()
                tracks = track_data.get("track")
                
                if not tracks:
                    return None
                
                # Look for the first track that has an album id
                id_album = None
                for track in tracks:
                    if track.get("idAlbum"):
                        id_album = track["idAlbum"]
                        break
                
                if not id_album:
                    return None
            
            # 2. Fetch the album details to get the year
            album_url = f"https://www.theaudiodb.com/api/v1/json/2/album.php?m={id_album}"
            async with session.get(album_url) as album_res:
                if album_res.status != 200:
                    return None
                
                album_data = await album_res.json()
                albums = album_data.get("album")
                
                if not albums:
                    return None
                
                year_str = albums[0].get("intYearReleased")
                if year_str and year_str != "0":
                    try:
                        year = int(year_str)
                        logger.info(
                            f"🎵 TheAudioDB знайшов рік релізу {year} для {artist} - {clean_title}"
                        )
                        return year
                    except ValueError:
                        pass
                
        return None
    except Exception as e:
        logger.warning(f"⚠️ Збій підсистеми TheAudioDB: {e}")
        return None
