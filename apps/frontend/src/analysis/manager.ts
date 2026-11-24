import { create } from "zustand";
import { Directory, File, Paths } from "expo-file-system";
import { ApiError, NetworkError, hasSession } from "../api/client";
import { analysisApi, type Job, type Usage } from "../api/endpoints";
import { getTrack, getTracksByStatus, updateTrack } from "../data/db";
import { applyAnalysisResult } from "../data/library";
import { refreshLibrary } from "../data/music";
import type { MusicTrack } from "../data/types";
import { createFragment } from "./fragment-io";
import { log } from "@/utils/logger";

const POLL_INTERVAL_MS = 3000;
const UPLOAD_CONCURRENCY = 2;

interface AnalysisState {
    usage: Usage | null;
    activeModelVersion: string | null;
    uploading: number;
    lastError: { code: "limit" | "network" | "other"; message: string } | null;
    refreshUsage: () => Promise<void>;
    clearError: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
    usage: null,
    activeModelVersion: null,
    uploading: 0,
    lastError: null,
    refreshUsage: async () => {
        if (!hasSession()) return;
        try {
            const [usage, model] = await Promise.all([analysisApi.usage(), analysisApi.model()]);
            set({ usage, activeModelVersion: model.version });
        } catch (error) {
            log.warn("Usage refresh failed", error);
        }
    },
    clearError: () => set({ lastError: null }),
}));

function setStatus(assetId: string, changes: Partial<MusicTrack>) {
    updateTrack(assetId, changes);
}

async function uploadOne(track: MusicTrack, force: boolean): Promise<"ok" | "limit" | "error"> {
    let fragment: ReturnType<typeof createFragment> | null = null;
    try {
        fragment = createFragment(track);
        const job = await analysisApi.enqueue(
            fragment.uri,
            track.assetId,
            fragment.filename,
            force
        );
        setStatus(track.assetId, {
            analysisStatus: job.status === "processing" ? "processing" : "queued",
            analysisJobId: job.id,
            analysisError: undefined,
        });
        return "ok";
    } catch (error) {
        if (error instanceof ApiError && error.code === "LIMIT_EXCEEDED") {
            setStatus(track.assetId, { analysisStatus: track.isAnalyzed ? "done" : "none" });
            const body = error.body as { used?: number; limit?: number };
            useAnalysisStore.setState({
                lastError: { code: "limit", message: `${body.used ?? "?"}/${body.limit ?? "?"}` },
            });
            return "limit";
        }
        const message = error instanceof Error ? error.message : String(error);
        setStatus(track.assetId, { analysisStatus: "failed", analysisError: message });
        if (error instanceof NetworkError) {
            useAnalysisStore.setState({ lastError: { code: "network", message } });
        }
        return "error";
    } finally {
        fragment?.cleanup();
    }
}

/**
 * Sends tracks for analysis (REQ 13). Each track is marked "queued" immediately; uploads run with
 * limited concurrency and stop as soon as the monthly limit is reached (REQ 20).
 */
export async function analyzeTracks(tracks: MusicTrack[], options: { force?: boolean } = {}) {
    if (tracks.length === 0) return;
    useAnalysisStore.setState({ lastError: null });
    for (const t of tracks)
        setStatus(t.assetId, { analysisStatus: "queued", analysisError: undefined });
    refreshLibrary();

    const queue = [...tracks];
    let stopped = false;
    useAnalysisStore.setState((s) => ({ uploading: s.uploading + tracks.length }));

    const worker = async () => {
        while (queue.length > 0) {
            const track = queue.shift()!;
            if (stopped) {
                setStatus(track.assetId, { analysisStatus: track.isAnalyzed ? "done" : "none" });
            } else if ((await uploadOne(track, !!options.force)) === "limit") {
                stopped = true;
            }
            useAnalysisStore.setState((s) => ({ uploading: Math.max(0, s.uploading - 1) }));
            refreshLibrary();
        }
    };
    await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
    refreshLibrary();
    void useAnalysisStore.getState().refreshUsage();
    startPolling();
}

/** Retries failed tracks (REQ 16): server-side retry when the fragment is still stored, re-upload otherwise. */
export async function retryFailed(tracks: MusicTrack[]) {
    const reupload: MusicTrack[] = [];
    for (const track of tracks) {
        if (!track.analysisJobId) {
            reupload.push(track);
            continue;
        }
        try {
            const job = await analysisApi.retry(track.analysisJobId);
            setStatus(track.assetId, {
                analysisStatus: job.status === "queued" ? "queued" : "processing",
                analysisError: undefined,
            });
        } catch {
            reupload.push(track);
        }
    }
    refreshLibrary();
    if (reupload.length) await analyzeTracks(reupload);
    else startPolling();
}

async function downloadArtwork(url: string, assetId: string): Promise<string | null> {
    try {
        const dir = new Directory(Paths.cache, "artwork");
        if (!dir.exists) dir.create({ intermediates: true });
        const ext = /\.(png|webp)/i.exec(url)?.[1] ?? "jpg";
        const target = new File(dir, `art_${assetId}_${Date.now()}.${ext}`);
        const file = await File.downloadFileAsync(url, target);
        return file.uri;
    } catch (error) {
        log.warn("Artwork download failed", error);
        return null;
    }
}

async function handleJob(job: Job) {
    const track = getTrack(job.trackId);
    if (!track || track.analysisJobId !== job.id) return;

    if (job.status === "done" && job.result) {
        const artwork =
            job.result.artwork && job.result.artwork.startsWith("http")
                ? await downloadArtwork(job.result.artwork, track.assetId)
                : null;
        applyAnalysisResult(track, job.result, {
            fingerprint: job.fingerprint,
            modelVersion: job.modelVersion,
            artwork,
        });
    } else if (job.status === "failed") {
        setStatus(track.assetId, {
            analysisStatus: "failed",
            analysisError: job.error ?? "Analysis failed",
        });
    } else if (job.status !== track.analysisStatus) {
        setStatus(track.assetId, { analysisStatus: job.status });
    }
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;

/** Polls job statuses (REQ 15) until nothing is pending; safe to call repeatedly. */
export function startPolling() {
    if (pollTimer || !hasSession()) return;
    const tick = async () => {
        pollTimer = null;
        const pending = getTracksByStatus(["queued", "processing"]).filter((t) => t.analysisJobId);
        if (pending.length === 0) {
            void useAnalysisStore.getState().refreshUsage();
            return;
        }
        try {
            const ids = pending.map((t) => t.analysisJobId!);
            for (let i = 0; i < ids.length; i += 100) {
                const jobs = await analysisApi.jobs(ids.slice(i, i + 100));
                for (const job of jobs) await handleJob(job);
            }
            refreshLibrary();
        } catch (error) {
            log.warn("Polling failed", error);
        }
        pollTimer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };
    pollTimer = setTimeout(() => void tick(), 500);
}

export function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
}
