import os
import re
from typing import (
    Tuple,
)

UNDERSCORE_DASH_PATTERN = re.compile(r"_+-_+")
UNDERSCORE_PATTERN = re.compile(r"_+")
CLEANUP_PATTERNS = [
    re.compile(
        r"\b(?:official\s+video|official\s+audio|офіційне\s+відео|офіційний\s+кліп|lyric\s+video|music\s+video|mv|pv|lyrics)\b",
        flags=re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:fanmade|fan\s+made|hq|hd|4k|audio|video|clip|кліп|відео)\b",
        flags=re.IGNORECASE,
    ),
    re.compile(
        r"[\(\[\{][^\)\]\}]*(?:video|audio|clip|кліп|відео|version|remix|edit|prod|soundtrack|lyrics)[^\)\]\}]*[\)\]\}]",
        flags=re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:пдіписати|підписати|українською|кавер|ukr\s+cover|ua\s+cover)\b",
        flags=re.IGNORECASE,
    ),
]
WHITESPACE_PATTERN = re.compile(r"\s+")
COVER_PATTERN = re.compile(
    r"\b(cover|кавер)\b",
    flags=re.IGNORECASE,
)
COVER_MATCH_PATTERN = re.compile(
    r"^(.*?)\s+(?:ukr\s+)?cover\s+by\s+(.*)$",
    flags=re.IGNORECASE,
)
OST_PATTERN = re.compile(
    r"(?:opening|op|ending|ed|ost|soundtrack).*$",
    flags=re.IGNORECASE,
)
BRACKET_START_PATTERN = re.compile(r"^[【\[\(\s「『＂]")
BRACKET_EXTRACT_PATTERN = re.compile(r"^[【\[\(\s「『＂]+(.*?)[\】\]\)」』＂]+\s*(.*)$")
STRIP_START_PATTERN = re.compile(r"^[_\-\–\—\s]+")
STRIP_END_PATTERN = re.compile(r"[_\-\–\—\s]+$")
YEAR_PATTERN = re.compile(r"\b(19\d{2}|20\d{2})\b")


WHITESPACE_RE = re.compile(r"\s+")
SEPARATOR_RE = re.compile(r"[\s\-_–—]+")
TRIM_RE = re.compile(r"^[\s\-_–—\|]+|[\s\-_–—\|]+$")

METADATA_RE = re.compile(
    r"X2Download\.app\s*-\s*|Y2meta\.app\s*-\s*|"
    r"\(\d+\s*kbps\)|"
    r"[\(\[\{].*?(?:official|video|audio|clip|кліп|відео|version|remix|edit|prod|soundtrack|lyrics|amv|op|ed|opening|ending).*?[\)\]\}]|"
    r"\b(?:official|fanmade|fan\s+made|hq|hd|4k|audio|video|clip|кліп|відео|українською|кавер|ukr\s+cover|ua\s+cover|amv|op|ed|opening|ending|full|lyrics)\b",
    flags=re.IGNORECASE,
)

EMOJI_PATTERN = re.compile(
    r"[\U00010000-\U0010ffff]",
    flags=re.UNICODE,
)


def clean_trash_name_from_youtube(
    text: str,
) -> str:
    """
    Production-safe cleaner for media filenames.
    - Normalizes separators to standard spacing.
    - Strips metadata-heavy bracketed content.
    - Handles leading/trailing junk.
    """
    if not text:
        return ""

    # Strip emojis and unicode trash
    text = EMOJI_PATTERN.sub(
        "",
        text,
    )

    # Normalize internal separators early
    text = re.sub(
        r"_+-_+",
        " - ",
        text,
    )
    text = re.sub(
        r"_+",
        " ",
        text,
    )

    # Strip metadata
    text = METADATA_RE.sub(
        "",
        text,
    )

    # Trim leading/trailing garbage
    text = TRIM_RE.sub(
        "",
        text,
    )

    # Normalize remaining whitespace and return
    return WHITESPACE_RE.sub(
        " ",
        text,
    ).strip()


def is_cover_track(
    filename: str,
) -> bool:
    """Checks if the filename implies the track is a cover."""
    name_without_ext = os.path.splitext(filename)[0]
    return bool(COVER_PATTERN.search(name_without_ext))


def parse_filename_fallback(
    filename: str,
) -> Tuple[
    str,
    str,
]:
    """Local filename parser with enhanced processing for covers and hieroglyphs"""
    name_without_ext = os.path.splitext(filename)[0]
    name_cleaned = clean_trash_name_from_youtube(name_without_ext)

    # 1. Specific processing for covers
    cover_match = COVER_MATCH_PATTERN.search(name_cleaned)
    if cover_match:
        potential_title = cover_match.group(1).strip()
        potential_artist = cover_match.group(2).strip()
        potential_artist = OST_PATTERN.sub(
            "",
            potential_artist,
        ).strip()
        return (
            (potential_artist if potential_artist else "Unknown Artist"),
            potential_title,
        )

    # 2. Processing Japanese/round brackets ONLY AT THE VERY BEGINNING of the string (e.g. 【Ado】MIRROR)
    if BRACKET_START_PATTERN.match(name_cleaned):
        brackets_match = BRACKET_EXTRACT_PATTERN.match(name_cleaned)
        if brackets_match:
            potential_artist = brackets_match.group(1).strip()
            potential_title = brackets_match.group(2).strip()
            if potential_title:
                potential_title = STRIP_START_PATTERN.sub(
                    "",
                    potential_title,
                ).strip()
                return (
                    potential_artist,
                    potential_title,
                )

    # 3. Strict separator rule
    for separator in [
        " - ",
        " – ",
        " — ",
        " ｜ ",
    ]:
        if separator in name_cleaned:
            parts = name_cleaned.split(
                separator,
                1,
            )
            artist_part = parts[0].strip()
            title_part = parts[1].strip()
            if artist_part and title_part:
                return (
                    artist_part,
                    title_part,
                )

    # 4. If nothing matches - return the name as Title
    name_cleaned = STRIP_END_PATTERN.sub(
        "",
        name_cleaned,
    ).strip()
    return (
        "Unknown Artist",
        (name_cleaned if name_cleaned else "Unknown Title"),
    )


def extract_year_from_filename(
    filename: str,
) -> int | None:
    """Extracts the year from the filename (1900-2099) as Fallback."""
    match = YEAR_PATTERN.search(filename)
    if match:
        return int(match.group(1))
    return None


def get_epoch_tag_by_year(
    year: int,
) -> str:
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
    period = human_periods.get(
        last_digit,
        "Mid",
    )

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
