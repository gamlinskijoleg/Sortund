import { getTrack, updateTrack } from "./db";
import { refreshLibrary } from "./music";
import type { EditableField, MusicTrack, TagDetail, TagCategory } from "./types";
import type { AnalysisResult } from "../api/endpoints";
import { correctionsApi } from "../api/endpoints";
import { hasSession } from "../api/client";
import { log } from "@/utils/logger";

export function toggleFavourite(assetId: string): boolean {
    const track = getTrack(assetId);
    if (!track) return false;
    const isFavourite = !track.isFavourite;
    updateTrack(assetId, { isFavourite, userUpdatedAt: Date.now() });
    refreshLibrary();
    return isFavourite;
}

export type TrackEdits = {
    title: string;
    artist: string;
    album?: string;
    year?: number;
    genre?: string;
    mood?: string;
    userTags: string[];
    removedTags: string[];
};

/**
 * Saves manual edits (REQ 39–40). Edited fields are remembered so a later analysis never overwrites
 * them; genre and mood fixes are sent to the server as training data (REQ 41).
 * Returns true when a correction was submitted.
 */
export async function saveTrackEdits(assetId: string, edits: TrackEdits): Promise<boolean> {
    const track = getTrack(assetId);
    if (!track) return false;

    const before: Record<EditableField, string | number | undefined> = {
        title: track.title,
        artist: track.artist,
        album: track.album,
        year: track.year,
        genre: track.genre,
        mood: track.mood,
    };
    const after: Record<EditableField, string | number | undefined> = {
        title: edits.title.trim(),
        artist: edits.artist.trim(),
        album: edits.album?.trim() || undefined,
        year: edits.year,
        genre: edits.genre?.trim() || undefined,
        mood: edits.mood?.trim() || undefined,
    };
    const changed = (Object.keys(after) as EditableField[]).filter(
        (f) => String(before[f] ?? "") !== String(after[f] ?? "")
    );
    const userEdited = [...new Set([...(track.userEdited ?? []), ...changed])];

    updateTrack(assetId, {
        title: after.title as string,
        artist: after.artist as string,
        album: after.album as string | undefined,
        year: after.year as number | undefined,
        date: after.year ? String(after.year) : track.date,
        genre: after.genre as string | undefined,
        mood: after.mood as string | undefined,
        userTags: edits.userTags,
        removedTags: edits.removedTags,
        userEdited,
        userUpdatedAt: Date.now(),
    });
    refreshLibrary();

    let sent = false;
    if (track.fingerprint && hasSession()) {
        for (const field of ["genre", "mood"] as const) {
            if (changed.includes(field) && after[field]) {
                try {
                    await correctionsApi.create(
                        track.fingerprint,
                        field,
                        (before[field] as string | undefined) ?? null,
                        after[field] as string
                    );
                    sent = true;
                } catch (error) {
                    log.warn(`Could not send ${field} correction`, error);
                }
            }
        }
    }
    return sent;
}

const CATEGORIES: TagCategory[] = [
    "genre",
    "style",
    "mood",
    "instrument",
    "vocal",
    "language",
    "theme",
];

/** Stores an analysis result locally without overwriting fields the user edited by hand. */
export function applyAnalysisResult(
    track: MusicTrack,
    result: AnalysisResult,
    meta: { fingerprint: string | null; modelVersion: string | null; artwork?: string | null }
) {
    const edited = new Set(track.userEdited ?? []);
    const keep = <T>(field: EditableField, current: T, next: T | null | undefined): T =>
        edited.has(field) ? current : (next ?? current);

    const tagDetails: TagDetail[] = result.tags.map((t) => ({
        label: t.label,
        category: (CATEGORIES.includes(t.category as TagCategory)
            ? t.category
            : "style") as TagCategory,
        confidence: t.confidence,
    }));

    updateTrack(track.assetId, {
        title: keep("title", track.title, result.title),
        artist: keep("artist", track.artist, result.artist),
        album: keep("album", track.album, result.album),
        year: keep("year", track.year, result.year),
        date: edited.has("year") ? track.date : (result.date ?? track.date),
        genre: keep("genre", track.genre, result.genre),
        mood: keep("mood", track.mood, result.mood),
        artwork: meta.artwork || track.artwork,
        analysis_source: result.metadata_source,
        fingerprint: meta.fingerprint ?? result.fingerprint,
        modelVersion: meta.modelVersion ?? result.model_version,
        bpm: result.bpm ?? undefined,
        musicalKey: result.key ?? undefined,
        language: result.language ?? undefined,
        themes: result.themes.map((t) => t.label),
        instruments: result.instruments.map((i) => i.label),
        vocal: result.vocal ?? undefined,
        lyrics: result.lyrics ?? undefined,
        lyricsSource: result.lyrics_source ?? undefined,
        tagDetails,
        isAnalyzed: true,
        analysisStatus: "done",
        analysisError: undefined,
    });
}
