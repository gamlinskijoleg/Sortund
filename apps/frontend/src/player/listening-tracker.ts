import { insertListen, updateListenDuration } from "../data/db";

/** Minimum listened time for a play to be recorded. */
const MIN_LISTEN_MS = 5000;
/** A jump larger than this between two status updates is a seek, not listening. */
const MAX_TICK_MS = 2000;

type Session = { assetId: string; startedAt: number; listenedMs: number; rowId: number | null };

let session: Session | null = null;
let lastPosition: number | null = null;

function flush() {
    if (!session || session.listenedMs < MIN_LISTEN_MS) return;
    try {
        if (session.rowId === null) {
            session.rowId = insertListen(session.assetId, session.startedAt, session.listenedMs);
        } else {
            updateListenDuration(session.rowId, session.listenedMs);
        }
    } catch {
        // statistics must never break playback
    }
}

/**
 * Accumulates real listening time per track (REQ 62) from player status updates:
 * only forward progress while playing is counted, seeks are ignored.
 */
export function onPlaybackStatus(assetId: string | null, positionSec: number, playing: boolean) {
    if (!assetId) return;
    if (!session || session.assetId !== assetId) {
        flush();
        session = { assetId, startedAt: Date.now(), listenedMs: 0, rowId: null };
        lastPosition = positionSec;
        return;
    }
    const deltaMs = lastPosition === null ? 0 : (positionSec - lastPosition) * 1000;
    lastPosition = positionSec;
    if (playing && deltaMs > 0 && deltaMs <= MAX_TICK_MS) {
        const before = session.listenedMs;
        session.listenedMs += deltaMs;
        // Persist every ~15 s so a killed app loses little history.
        if (Math.floor(before / 15000) !== Math.floor(session.listenedMs / 15000)) flush();
    }
    if (!playing) flush();
}

/** Called when the track is restarted ("repeat one") — the next pass is a new play. */
export function restartSession() {
    flush();
    session = null;
    lastPosition = null;
}
