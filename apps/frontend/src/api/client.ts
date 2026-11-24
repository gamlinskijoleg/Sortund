import * as SecureStore from "expo-secure-store";
import { File, UploadType } from "expo-file-system";
import { log } from "@/utils/logger";

const ACCESS_KEY = "sortund.accessToken";
const REFRESH_KEY = "sortund.refreshToken";

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly body: unknown
    ) {
        super(message);
    }

    get code(): string | undefined {
        const b = this.body as { code?: unknown } | null;
        return typeof b?.code === "string" ? b.code : undefined;
    }
}

/** Server is unreachable (no network, wrong URL, server down). */
export class NetworkError extends Error {}

export function apiBaseUrl(): string {
    const url = process.env.EXPO_PUBLIC_API_URL;
    if (!url) throw new NetworkError("EXPO_PUBLIC_API_URL is not set");
    return url.replace(/\/$/, "");
}

export type TokenPair = { accessToken: string; refreshToken: string };

let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokensLoaded = false;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
    onSessionExpired = handler;
}

export async function loadTokens(): Promise<boolean> {
    if (!tokensLoaded) {
        accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
        refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
        tokensLoaded = true;
    }
    return !!refreshToken;
}

export async function saveTokens(pair: TokenPair | null) {
    accessToken = pair?.accessToken ?? null;
    refreshToken = pair?.refreshToken ?? null;
    tokensLoaded = true;
    if (pair) {
        await SecureStore.setItemAsync(ACCESS_KEY, pair.accessToken);
        await SecureStore.setItemAsync(REFRESH_KEY, pair.refreshToken);
    } else {
        await SecureStore.deleteItemAsync(ACCESS_KEY);
        await SecureStore.deleteItemAsync(REFRESH_KEY);
    }
}

export function hasSession(): boolean {
    return !!refreshToken;
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
    try {
        return await fetch(`${apiBaseUrl()}${path}`, init);
    } catch (error) {
        if (error instanceof NetworkError) throw error;
        throw new NetworkError(String(error));
    }
}

let refreshing: Promise<boolean> | null = null;

/**
 * Exchanges the refresh token for a new pair (REQ 7). Concurrent callers share one request,
 * because the refresh token is single-use on the server.
 */
export function refreshTokens(): Promise<boolean> {
    if (!refreshToken) return Promise.resolve(false);
    if (!refreshing) {
        const current = refreshToken;
        refreshing = (async () => {
            try {
                const res = await rawFetch("/auth/refresh", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${current}` },
                });
                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        await saveTokens(null);
                        onSessionExpired?.();
                    }
                    return false;
                }
                await saveTokens((await res.json()) as TokenPair);
                return true;
            } finally {
                refreshing = null;
            }
        })();
    }
    return refreshing;
}

async function parseBody(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

function errorMessage(body: unknown, status: number): string {
    const message = (body as { message?: unknown } | null)?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
    return `HTTP ${status}`;
}

export async function api<T>(
    path: string,
    options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
    await loadTokens();
    const { method = "GET", body, auth = true } = options;

    const send = () => {
        const headers: Record<string, string> = { Accept: "application/json" };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
        return rawFetch(path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    };

    let res = await send();
    if (res.status === 401 && auth && (await refreshTokens())) {
        res = await send();
    }
    const data = await parseBody(res);
    if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data);
    return data as T;
}

/** Multipart upload of a local file with extra form fields (used for analysis fragments). */
export async function uploadFile<T>(
    path: string,
    fileUri: string,
    fields: Record<string, string>
): Promise<T> {
    await loadTokens();
    const file = new File(fileUri);

    const send = async () => {
        try {
            return await file.upload(`${apiBaseUrl()}${path}`, {
                httpMethod: "POST",
                uploadType: UploadType.MULTIPART,
                fieldName: "file",
                parameters: fields,
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            });
        } catch (error) {
            throw new NetworkError(String(error));
        }
    };

    let res = await send();
    if (res.status === 401 && (await refreshTokens())) res = await send();
    let data: unknown = res.body;
    try {
        data = JSON.parse(res.body) as unknown;
    } catch {
        log.debug("Upload response is not JSON");
    }
    if (res.status < 200 || res.status >= 300) {
        throw new ApiError(errorMessage(data, res.status), res.status, data);
    }
    return data as T;
}
