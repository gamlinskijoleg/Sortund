import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { AnalysisJob, JobStatus } from "./entities/analysis-job.entity";
import { TrackAnalysis } from "./entities/track-analysis.entity";
import {
    AiWorkerClient,
    FingerprintResult,
    WorkerAnalysisResult,
    WorkerError,
} from "../ai-worker/ai-worker.client";
import { ModelsService } from "../models/models.service";
import { UsersService } from "../users/users.service";
import { PushService } from "./push.service";

const STALE_PROCESSING_MS = 15 * 60_000;
const MAX_ERROR_LENGTH = 2000;

/**
 * In-process consumer of the Postgres-backed analysis queue.
 * Jobs are claimed with FOR UPDATE SKIP LOCKED, so several backend instances can run safely.
 */
@Injectable()
export class AnalysisProcessor implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AnalysisProcessor.name);
    private timer: NodeJS.Timeout | null = null;
    private inFlight = 0;
    private ticking = false;
    private readonly concurrency: number;
    private readonly pollIntervalMs: number;
    private readonly enabled: boolean;

    constructor(
        @InjectRepository(AnalysisJob)
        private readonly jobs: Repository<AnalysisJob>,
        @InjectRepository(TrackAnalysis)
        private readonly analyses: Repository<TrackAnalysis>,
        private readonly worker: AiWorkerClient,
        private readonly modelsService: ModelsService,
        private readonly usersService: UsersService,
        private readonly push: PushService,
        private readonly dataSource: DataSource,
        config: ConfigService
    ) {
        this.concurrency = config.get<number>("ANALYSIS_CONCURRENCY", 2);
        this.pollIntervalMs = config.get<number>("ANALYSIS_POLL_INTERVAL_MS", 1000);
        this.enabled = String(config.get("ANALYSIS_PROCESSOR_ENABLED", true)) !== "false";
    }

    async onModuleInit(): Promise<void> {
        if (!this.enabled) return;
        await this.requeueStale();
        this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
    }

    onModuleDestroy(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    /** Jobs left in "processing" by a crashed instance go back to the queue. */
    private async requeueStale(): Promise<void> {
        await this.dataSource.query(
            `UPDATE analysis_jobs SET status = 'queued', started_at = NULL
             WHERE status = 'processing' AND started_at < now() - ($1 || ' milliseconds')::interval`,
            [String(STALE_PROCESSING_MS)]
        );
    }

    async tick(): Promise<void> {
        if (this.ticking) return;
        this.ticking = true;
        try {
            const free = this.concurrency - this.inFlight;
            if (free <= 0) return;
            const claimed = await this.claim(free);
            for (const id of claimed) {
                this.inFlight++;
                void this.process(id).finally(() => this.inFlight--);
            }
        } catch (error) {
            this.logger.error(`Queue tick failed: ${String(error)}`);
        } finally {
            this.ticking = false;
        }
    }

    private async claim(limit: number): Promise<string[]> {
        const rows: unknown = await this.dataSource.query(
            `UPDATE analysis_jobs SET status = 'processing', started_at = now(), attempts = attempts + 1
             WHERE id IN (
                SELECT id FROM analysis_jobs WHERE status = 'queued'
                ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED
             )
             RETURNING id`,
            [limit]
        );
        // pg returns [rows, count] for UPDATE ... RETURNING through TypeORM.
        const list = (Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows) as {
            id: string;
        }[];
        return list.map((r) => r.id);
    }

    /** Processes one claimed job. Public for tests. */
    async process(jobId: string): Promise<void> {
        const job = await this.jobs
            .createQueryBuilder("j")
            .addSelect("j.payload")
            .where("j.id = :jobId", { jobId })
            .getOne();
        if (!job || !job.payload) {
            await this.fail(jobId, "Audio fragment is missing");
            return;
        }

        const started = Date.now();
        try {
            const modelVersion = await this.modelsService.getActiveVersion();
            const fp: FingerprintResult = await this.worker.fingerprint(job.payload, job.filename);

            let analysis = job.force
                ? null
                : await this.analyses.findOne({
                      where: { fingerprint: fp.fingerprint, modelVersion },
                  });
            const fromCache = !!analysis;

            if (!analysis) {
                const result = await this.analyzeWithRestore(job, fp, modelVersion);
                analysis = await this.storeResult(fp.fingerprint, modelVersion, result);
            }

            await this.jobs.update(job.id, {
                status: JobStatus.Done,
                error: null,
                fromCache,
                countsTowardLimit: !fromCache,
                fingerprint: fp.fingerprint,
                analysisId: analysis.id,
                modelVersion,
                payload: null,
                durationMs: Date.now() - started,
                finishedAt: new Date(),
            });
            this.logger.log(
                `Job ${job.id} done (${fromCache ? "cache" : "analysed"}) in ${Date.now() - started} ms`
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Job ${job.id} failed: ${message}`);
            await this.fail(job.id, message, Date.now() - started);
        }

        await this.notifyIfQueueEmpty(job.userId);
    }

    private async analyzeWithRestore(
        job: AnalysisJob,
        fp: FingerprintResult,
        modelVersion: string
    ): Promise<WorkerAnalysisResult> {
        const call = () =>
            this.worker.analyze(job.payload!, job.filename, {
                modelVersion,
                fingerprint: fp.fingerprint,
                recognition: fp.recognition,
            });
        try {
            return await call();
        } catch (error) {
            // The worker lost this model version (e.g. redeploy) — upload it and try once more.
            if (
                error instanceof WorkerError &&
                error.status === 409 &&
                error.detail?.startsWith("genre_model_missing") &&
                (await this.modelsService.restoreOnWorker(modelVersion))
            ) {
                return call();
            }
            throw error;
        }
    }

    private async storeResult(
        fingerprint: string,
        modelVersion: string,
        result: WorkerAnalysisResult
    ): Promise<TrackAnalysis> {
        const { embedding, features, ...rest } = result;
        const entity = this.analyses.create({
            fingerprint,
            modelVersion,
            result: rest,
            embedding,
            features,
            genre: result.genre ?? null,
            processingMs: result.processing_ms ?? null,
        });
        await this.analyses.upsert(entity as QueryDeepPartialEntity<TrackAnalysis>, {
            conflictPaths: ["fingerprint", "modelVersion"],
        });
        return this.analyses.findOneOrFail({ where: { fingerprint, modelVersion } });
    }

    private async fail(jobId: string, message: string, durationMs?: number): Promise<void> {
        await this.jobs.update(jobId, {
            status: JobStatus.Failed,
            error: message.slice(0, MAX_ERROR_LENGTH),
            durationMs: durationMs ?? null,
            finishedAt: new Date(),
        });
    }

    /** Sends one push when all of the user's queued tracks are finished (REQ 17). */
    private async notifyIfQueueEmpty(userId: string): Promise<void> {
        try {
            const pending = await this.jobs.count({
                where: { userId, status: In([JobStatus.Queued, JobStatus.Processing]) },
            });
            if (pending > 0) return;

            const finished = await this.jobs.find({
                where: { userId, notified: false, status: In([JobStatus.Done, JobStatus.Failed]) },
                select: { id: true, status: true },
            });
            if (finished.length === 0) return;
            await this.jobs.update({ id: In(finished.map((j) => j.id)) }, { notified: true });

            const user = await this.usersService.findById(userId);
            if (!user?.pushToken) return;
            const done = finished.filter((j) => j.status === JobStatus.Done).length;
            const failed = finished.length - done;
            await this.push.send(
                user.pushToken,
                "Sortund",
                failed > 0
                    ? `Analysis finished: ${done} ready, ${failed} failed`
                    : `Analysis finished: ${done} track(s) ready`,
                { type: "analysis_finished", done, failed }
            );
        } catch (error) {
            this.logger.warn(`Notification step failed: ${String(error)}`);
        }
    }
}
