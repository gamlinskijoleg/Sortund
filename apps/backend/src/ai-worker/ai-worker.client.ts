import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ModelMetrics } from "../models/entities/model-version.entity";

export interface Recognition {
    artist: string;
    title: string;
    artwork?: string | null;
    isrc?: string | null;
    shazam_key?: string | null;
}

export interface FingerprintResult {
    fingerprint: string;
    recognition: Recognition | null;
}

/** Shape of the worker's /v1/analyze-track response (only the fields the backend relies on). */
export interface WorkerAnalysisResult {
    fingerprint: string;
    model_version: string;
    genre: string | null;
    embedding: number[];
    features: number[];
    processing_ms: number;
    [key: string]: unknown;
}

export interface TrainResponse {
    version: string;
    metrics: ModelMetrics;
    weights_b64: string;
}

export class WorkerError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly detail?: string
    ) {
        super(message);
    }
}

/** HTTP client for the Python AI worker. */
@Injectable()
export class AiWorkerClient {
    private readonly logger = new Logger(AiWorkerClient.name);
    private readonly baseUrl: string;
    private readonly token: string;

    constructor(config: ConfigService) {
        this.baseUrl = config
            .get<string>("AI_WORKER_URL", "http://localhost:8000")
            .replace(/\/$/, "");
        this.token = config.get<string>("AI_WORKER_TOKEN", "");
    }

    private headers(extra: Record<string, string> = {}): Record<string, string> {
        return this.token ? { "X-Worker-Token": this.token, ...extra } : extra;
    }

    private async request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}${path}`, {
                ...init,
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (error) {
            throw new WorkerError(`AI worker unreachable: ${String(error)}`, 503);
        }
        if (!response.ok) {
            let detail: string | undefined;
            try {
                const body = (await response.json()) as { detail?: unknown };
                detail =
                    typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
            } catch {
                detail = await response.text().catch(() => undefined);
            }
            throw new WorkerError(
                `AI worker responded ${response.status}: ${detail ?? ""}`,
                response.status,
                detail
            );
        }
        return (await response.json()) as T;
    }

    private form(payload: Buffer, filename: string, fields: Record<string, string> = {}): FormData {
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(payload)]), filename);
        for (const [key, value] of Object.entries(fields)) form.append(key, value);
        return form;
    }

    fingerprint(payload: Buffer, filename: string): Promise<FingerprintResult> {
        return this.request<FingerprintResult>(
            "/v1/fingerprint",
            { method: "POST", body: this.form(payload, filename), headers: this.headers() },
            60_000
        );
    }

    analyze(
        payload: Buffer,
        filename: string,
        options: { modelVersion: string; fingerprint: string; recognition: Recognition | null }
    ): Promise<WorkerAnalysisResult> {
        const fields: Record<string, string> = {
            model_version: options.modelVersion,
            fingerprint: options.fingerprint,
            skip_recognition: options.recognition ? "true" : "false",
        };
        if (options.recognition) fields.recognition = JSON.stringify(options.recognition);
        return this.request<WorkerAnalysisResult>(
            "/v1/analyze-track",
            { method: "POST", body: this.form(payload, filename, fields), headers: this.headers() },
            300_000
        );
    }

    listModels(): Promise<{ version: string; metrics: ModelMetrics | null }[]> {
        return this.request("/v1/genre-models", { headers: this.headers() }, 15_000);
    }

    exportModel(
        version: string
    ): Promise<{ version: string; metrics: ModelMetrics | null; weights_b64: string }> {
        return this.request(
            `/v1/genre-models/${encodeURIComponent(version)}`,
            { headers: this.headers() },
            30_000
        );
    }

    async uploadModel(
        version: string,
        weights: Buffer,
        metrics: ModelMetrics | null
    ): Promise<void> {
        await this.request(
            `/v1/genre-models/${encodeURIComponent(version)}`,
            {
                method: "PUT",
                headers: this.headers({ "Content-Type": "application/json" }),
                body: JSON.stringify({ weights_b64: weights.toString("base64"), metrics }),
            },
            30_000
        );
        this.logger.log(`Uploaded genre model ${version} to the AI worker`);
    }

    train(
        version: string,
        samples: { features: number[]; label: string }[]
    ): Promise<TrainResponse> {
        return this.request<TrainResponse>(
            "/v1/genre-models/train",
            {
                method: "POST",
                headers: this.headers({ "Content-Type": "application/json" }),
                body: JSON.stringify({ version, samples }),
            },
            600_000
        );
    }
}
