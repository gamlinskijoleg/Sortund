import pytest
from app.core.utils import (
    clean_trash_name_from_youtube,
    is_cover_track,
    parse_filename_fallback,
    extract_year_from_filename,
    get_epoch_tag_by_year,
)


def test_clean_youtube_trash():
    assert clean_trash_name_from_youtube("My_Song_-_Official_Video") == "My Song"
    assert clean_trash_name_from_youtube("Song__Name___Here") == "Song Name Here"

    # Testing cleanup patterns
    assert clean_trash_name_from_youtube("My Song (Official Video)") == "My Song"
    assert clean_trash_name_from_youtube("My Song [HQ Audio]") == "My Song"
    assert clean_trash_name_from_youtube("My Song {Remix}") == "My Song"


def test_is_cover_track():
    assert is_cover_track("Song Name (cover).mp3") == True
    assert is_cover_track("Song Name ukr cover.mp3") == True
    assert is_cover_track("Song Name кавер.mp3") == True
    assert is_cover_track("Original Song.mp3") == False


def test_parse_filename_fallback():
    # Regular artist - title
    assert parse_filename_fallback("Artist - Title.mp3") == (
        "Artist",
        "Title",
    )
    assert parse_filename_fallback("Artist – Title.mp3") == (
        "Artist",
        "Title",
    )
    assert parse_filename_fallback("Artist — Title.mp3") == (
        "Artist",
        "Title",
    )

    # Cover track that hits COVER_MATCH_PATTERN
    assert parse_filename_fallback("My Awesome Song cover by The Great Artist.mp3") == (
        "The Great Artist",
        "My Awesome Song",
    )

    # Cover track where artist gets stripped by OST_PATTERN
    assert parse_filename_fallback("Anime Theme cover by OST.mp3") == (
        "Unknown Artist",
        "Anime Theme",
    )

    # Legacy tests that fall back to Unknown Artist due to METADATA_RE stripping "ukr cover"
    assert parse_filename_fallback("Title ukr cover by Artist.mp3") == (
        "Unknown Artist",
        "Title by Artist",
    )

    # Brackets track
    assert parse_filename_fallback("【artist】Title.mp3") == (
        "artist",
        "Title",
    )
    assert parse_filename_fallback("[Artist] Title.mp3") == (
        "Artist",
        "Title",
    )
    assert parse_filename_fallback("(Artist) Title.mp3") == (
        "Artist",
        "Title",
    )
    assert parse_filename_fallback("「Artist」 Title.mp3") == (
        "Artist",
        "Title",
    )
    assert parse_filename_fallback("『Artist』 Title.mp3") == (
        "Artist",
        "Title",
    )
    assert parse_filename_fallback("＂Artist＂ Title.mp3") == (
        "Artist",
        "Title",
    )

    # Unknown artist fallback
    assert parse_filename_fallback("Just A Title.mp3") == (
        "Unknown Artist",
        "Just A Title",
    )
    assert parse_filename_fallback("Ado-FREEDOM.mp3") == (
        "Unknown Artist",
        "Ado-FREEDOM",
    )
    assert parse_filename_fallback("Spider-Man.mp3") == (
        "Unknown Artist",
        "Spider-Man",
    )


def test_clean_trash_name_from_youtube_edge_cases():
    # Emojis
    assert (
        clean_trash_name_from_youtube("🦇 ZWYNTAR — Кажани 1983 [LYRICS VIDEO]")
        == "ZWYNTAR — Кажани 1983"
    )

    # X2Download and kbps
    assert (
        clean_trash_name_from_youtube("X2Download.app - A Silent Voice (128 kbps)")
        == "A Silent Voice"
    )
    assert (
        clean_trash_name_from_youtube("Y2meta.app - NOTHING'S NEW - RIO ROMEO (128 kbps)")
        == "NOTHING'S NEW - RIO ROMEO"
    )

    # Anime tags
    assert (
        clean_trash_name_from_youtube(
            "Boku_no_Hero_Academia_Season_4_Ending_Full『Sayuri_Koukai_no_Uta』【ENG"
        )
        == "Boku no Hero Academia Season 4 『Sayuri Koukai no Uta』【ENG"
    )


def test_clean_trash_name_empty():
    assert clean_trash_name_from_youtube("") == ""
    assert clean_trash_name_from_youtube(None) == ""


def test_extract_year_from_filename():
    assert extract_year_from_filename("Song 1999.mp3") == 1999
    assert extract_year_from_filename("Song (2023).mp3") == 2023
    assert extract_year_from_filename("No year here.mp3") is None


def test_get_epoch_tag_by_year():
    assert get_epoch_tag_by_year(1899) == "really really REALLY old"
    assert get_epoch_tag_by_year(1945) == "Pre-1950s"
    assert get_epoch_tag_by_year(1950) == "Early 50s"
    assert get_epoch_tag_by_year(1965) == "Mid 60s"
    assert get_epoch_tag_by_year(1979) == "Late 70s"
    assert get_epoch_tag_by_year(1983) == "Mid 80s"
    assert get_epoch_tag_by_year(1991) == "Early 90s"
    assert get_epoch_tag_by_year(2005) == "Mid 2000s"
    assert get_epoch_tag_by_year(2018) == "Late 2010s"
    assert get_epoch_tag_by_year(2022) == "Early 2020s"
    assert get_epoch_tag_by_year(2035) == "Modern Release"
