import os
import re
from typing import Tuple


def clean_youtube_trash(text: str) -> str:
    """Cleans the filename from YouTube trash and specific artifacts"""
    # Replace all types of underscores with spaces, preserving separators
    text = re.sub(r"_+-_+", " - ", text)
    text = re.sub(r"_+", " ", text)

    cleanup_patterns = [
        r"\b(?:official\s+video|official\s+audio|офіційне\s+відео|офіційний\s+кліп|lyric\s+video|music\s+video|mv|pv|lyrics)\b",
        r"\b(?:fanmade|fan\s+made|hq|hd|4k|audio|video|clip|кліп|відео)\b",
        r"[\(\[\{][^\)\]\}]*(?:video|audio|clip|кліп|відео|version|remix|edit|prod|soundtrack|lyrics)[^\)\]\}]*[\)\]\}]",
        r"\b(?:пдіписати|підписати|українською|кавер|ukr\s+cover|ua\s+cover)\b",
    ]
    for pattern in cleanup_patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

    return re.sub(r"\s+", " ", text).strip()


def is_cover_track(filename: str) -> bool:
    """Checks if the filename implies the track is a cover."""
    name_without_ext = os.path.splitext(filename)[0]
    return bool(re.search(r"\b(cover|кавер)\b", name_without_ext, flags=re.IGNORECASE))


def parse_filename_fallback(filename: str) -> Tuple[str, str]:
    """Local filename parser with enhanced processing for covers and hieroglyphs"""
    name_without_ext = os.path.splitext(filename)[0]
    name_cleaned = clean_youtube_trash(name_without_ext)

    # 1. Specific processing for covers
    cover_match = re.search(
        r"^(.*?)\s+(?:ukr\s+)?cover\s+by\s+(.*)$", name_cleaned, flags=re.IGNORECASE
    )
    if cover_match:
        potential_title = cover_match.group(1).strip()
        potential_artist = cover_match.group(2).strip()
        potential_artist = re.sub(
            r"(?:opening|op|ending|ed|ost|soundtrack).*$",
            "",
            potential_artist,
            flags=re.IGNORECASE,
        ).strip()
        return (
            potential_artist if potential_artist else "Unknown Artist"
        ), potential_title

    # 2. Processing Japanese/round brackets ONLY AT THE VERY BEGINNING of the string (e.g. 【Ado】MIRROR)
    # Change: add ^[【\[\(\s]+ to ensure the string ACTUALLY STARTS with a bracket
    if re.match(r"^[【\[\(\s]", name_cleaned):
        brackets_match = re.match(r"^[【\[\(\s]*(.*?)[】\]\)\s]+(.*)$", name_cleaned)
        if brackets_match:
            potential_artist = brackets_match.group(1).strip()
            potential_title = brackets_match.group(2).strip()
            if potential_title:
                potential_title = re.sub(r"^[_\-\–\—\s]+", "", potential_title).strip()
                return potential_artist, potential_title

    # 3. Strict separator rule
    for separator in [" - ", " – ", " — "]:
        if separator in name_cleaned:
            parts = name_cleaned.split(separator, 1)
            artist_part = parts[0].strip()
            title_part = parts[1].strip()
            if artist_part and title_part:
                return artist_part, title_part

    # 4. If nothing matches - return the name as Title
    name_cleaned = re.sub(r"[_\-\–\—\s]+$", "", name_cleaned).strip()
    return "Unknown Artist", name_cleaned if name_cleaned else "Unknown Title"


def extract_year_from_filename(filename: str) -> int | None:
    """Extracts the year from the filename (1900-2099) as Fallback."""
    match = re.search(r"\b(19\d{2}|20\d{2})\b", filename)
    if match:
        return int(match.group(1))
    return None


def get_epoch_tag_by_year(year: int) -> str:
    """Determines the epoch (e.g. '80s', 'Early 2000s') by release year."""
    if year < 1900:
        return "really really REALLY old"

    human_periods = {
        0: "Early",
        1: "Early",
        2: "Early",
        3: "Mid",
        4: "Mid",
        5: "Mid",
        6: "Mid",
        7: "Late",
        8: "Late",
        9: "Late",
    }

    last_digit = year % 10
    period = human_periods.get(last_digit, "Mid")

    if year < 1950:
        return "Pre-1950s"
    elif 1950 <= year < 1960:
        return f"{period} 50s"
    elif 1960 <= year < 1970:
        return f"{period} 60s"
    elif 1970 <= year < 1980:
        return f"{period} 70s"
    elif 1980 <= year < 1990:
        return f"{period} 80s"
    elif 1990 <= year < 2000:
        return f"{period} 90s"
    elif 2000 <= year < 2010:
        return f"{period} 2000s"
    elif 2010 <= year < 2020:
        return f"{period} 2010s"
    elif 2020 <= year < 2030:
        return f"{period} 2020s"

    return "Modern Release"
