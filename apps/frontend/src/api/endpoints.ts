import { api, uploadFile, type TokenPair } from "./client";

export type UserProfile = {
    id: string;
    email: string;
    role: "user" | "admin";
    monthlyAnalysisLimit: number;
};

export type Usage = {
    used: number;
    pending: number;
    limit: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
};

export type JobStatus = "queued" | "processing" | "done" | "failed";

export type LabelScore = { label: string; confidence: number };

/** Analysis result produced by the AI worker (vectors are not sent to clients). */
export type AnalysisResult = {
    fingerprint: string;
    model_version: string;
    title: string | null;
    artist: string | null;
    album: string | null;
    artwork: string | null;
    year: number | null;
    date: string | null;
    metadata_source: string;
    year_source: string | null;
    genre: string | null;
    genre_confidence: number | null;
    mood: string | null;
    mood_confidence: number | null;
    moods: LabelScore[];
    instruments: LabelScore[];
    vocal: string | null;
    vocal_confidence: number | null;
    language: string | null;
    language_confidence: number | null;
    lyrics: string | null;
    lyrics_source: string | null;
    themes: LabelScore[];
    bpm: number | null;
    key: string | null;
    key_confidence: number | null;
    tags: { label: string; category: string; confidence: number }[];
};

export type Job = {
    id: string;
    trackId: string;
    status: JobStatus;
    error: string | null;
    fromCache: boolean;
    fingerprint: string | null;
    modelVersion: string | null;
    result?: AnalysisResult | null;
};

export const authApi = {
    register: (email: string, password: string) =>
        api<TokenPair>("/auth/register", {
            method: "POST",
            body: { email, password },
            auth: false,
        }),
    login: (email: string, password: string) =>
        api<TokenPair>("/auth/login", { method: "POST", body: { email, password }, auth: false }),
    logout: () => api<unknown>("/auth/logout", { method: "POST" }),
    logoutAll: () => api<unknown>("/auth/sessions", { method: "DELETE" }),
    me: () => api<UserProfile>("/users/me"),
    setPushToken: (token: string | null) =>
        api<unknown>("/users/me/push-token", { method: "PUT", body: { token } }),
};

export const analysisApi = {
    enqueue: (fragmentUri: string, trackId: string, filename: string, force: boolean) =>
        uploadFile<Job>("/analysis/jobs", fragmentUri, {
            trackId,
            filename,
            force: force ? "true" : "false",
        }),
    jobs: (ids: string[]) => api<Job[]>(`/analysis/jobs?ids=${ids.join(",")}`),
    retry: (id: string) => api<Job>(`/analysis/jobs/${id}/retry`, { method: "POST" }),
    usage: () => api<Usage>("/analysis/usage"),
    model: () => api<{ version: string; labels: string[] }>("/analysis/model"),
    similar: (fingerprint: string, candidates: string[], limit = 30) =>
        api<{ fingerprint: string; score: number }[]>("/analysis/similar", {
            method: "POST",
            body: { fingerprint, candidates, limit },
        }),
};

export const correctionsApi = {
    create: (
        fingerprint: string,
        field: "genre" | "mood",
        oldValue: string | null,
        newValue: string
    ) =>
        api<{ id: string }>("/corrections", {
            method: "POST",
            body: { fingerprint, field, oldValue, newValue },
        }),
};

export type SyncItem = { key: string; data: Record<string, unknown>; updatedAt: number };
export type SyncPlaylist = {
    id: string;
    data: Record<string, unknown>;
    deleted?: boolean;
    updatedAt: number;
};

export const syncApi = {
    sync: (items: SyncItem[], playlists: SyncPlaylist[], since: number) =>
        api<{
            items: SyncItem[];
            playlists: (SyncPlaylist & { deleted: boolean })[];
            serverTime: number;
            accepted: { items: number; playlists: number };
        }>("/sync", { method: "POST", body: { items, playlists, since } }),
};
