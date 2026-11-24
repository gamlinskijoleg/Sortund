import {
    BadRequestException,
    ForbiddenException,
    GoneException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, MoreThanOrEqual, Repository } from "typeorm";
import { AnalysisJob, JobStatus } from "./entities/analysis-job.entity";
import { TrackAnalysis } from "./entities/track-analysis.entity";
import { UsersService } from "../users/users.service";
import { ModelsService } from "../models/models.service";

export const SUPPORTED_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".flac"];
export const MAX_FRAGMENT_BYTES = 12 * 1024 * 1024;

export interface Usage {
    used: number;
    pending: number;
    limit: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
}

export interface JobDto {
    id: string;
    trackId: string;
    status: JobStatus;
    error: string | null;
    fromCache: boolean;
    fingerprint: string | null;
    modelVersion: string | null;
    createdAt: Date;
    finishedAt: Date | null;
    result?: Record<string, unknown> | null;
}

export function monthBounds(now = new Date()): { start: Date; end: Date } {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
}

export function cosineSimilarity(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < n; i++) {
        const x = a[i]!;
        const y = b[i]!;
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

@Injectable()
export class AnalysisService {
    constructor(
        @InjectRepository(AnalysisJob)
        private readonly jobs: Repository<AnalysisJob>,
        @InjectRepository(TrackAnalysis)
        private readonly analyses: Repository<TrackAnalysis>,
        private readonly usersService: UsersService,
        private readonly modelsService: ModelsService,
        private readonly dataSource: DataSource
    ) {}

    // ── Limits ───────────────────────────────────────────────────────────────

    async usage(userId: string): Promise<Usage> {
        const user = await this.usersService.findById(userId);
        if (!user) throw new NotFoundException();
        const { start, end } = monthBounds();
        const [used, pending] = await Promise.all([
            this.jobs.count({
                where: { userId, countsTowardLimit: true, finishedAt: MoreThanOrEqual(start) },
            }),
            this.jobs.count({
                where: { userId, status: In([JobStatus.Queued, JobStatus.Processing]) },
            }),
        ]);
        return {
            used,
            pending,
            limit: user.monthlyAnalysisLimit,
            remaining: Math.max(0, user.monthlyAnalysisLimit - used),
            periodStart: start.toISOString(),
            periodEnd: end.toISOString(),
        };
    }

    // ── Queue ────────────────────────────────────────────────────────────────

    async enqueue(
        userId: string,
        params: { trackId: string; filename: string; payload: Buffer; force: boolean }
    ): Promise<JobDto> {
        const lower = params.filename.toLowerCase();
        if (!SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
            throw new BadRequestException("Unsupported audio format");
        }
        if (params.payload.length === 0 || params.payload.length > MAX_FRAGMENT_BYTES) {
            throw new BadRequestException("Audio fragment is empty or too large");
        }

        return this.dataSource.transaction(async (manager) => {
            // Serialise enqueues of the same user so two parallel uploads cannot overrun the limit.
            await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);

            // A track that is already waiting is not queued twice.
            const duplicate = await manager.findOne(AnalysisJob, {
                where: {
                    userId,
                    clientTrackId: params.trackId,
                    status: In([JobStatus.Queued, JobStatus.Processing]),
                },
            });
            if (duplicate) return this.toDto(duplicate);

            await this.assertWithinLimit(userId, manager.getRepository(AnalysisJob));

            const job = await manager.save(
                manager.create(AnalysisJob, {
                    userId,
                    clientTrackId: params.trackId,
                    filename: params.filename.slice(0, 512),
                    payload: params.payload,
                    force: params.force,
                    status: JobStatus.Queued,
                })
            );
            return this.toDto(job);
        });
    }

    private async assertWithinLimit(userId: string, repo: Repository<AnalysisJob>): Promise<void> {
        const user = await this.usersService.findById(userId);
        if (!user) throw new NotFoundException();
        const { start } = monthBounds();
        const [used, pending] = await Promise.all([
            repo.count({
                where: { userId, countsTowardLimit: true, finishedAt: MoreThanOrEqual(start) },
            }),
            repo.count({
                where: { userId, status: In([JobStatus.Queued, JobStatus.Processing]) },
            }),
        ]);
        if (used + pending >= user.monthlyAnalysisLimit) {
            throw new ForbiddenException({
                code: "LIMIT_EXCEEDED",
                message: "Monthly analysis limit reached",
                used,
                pending,
                limit: user.monthlyAnalysisLimit,
            });
        }
    }

    async retry(jobId: string, userId?: string): Promise<JobDto> {
        const job = await this.jobs
            .createQueryBuilder("j")
            .addSelect("j.payload IS NOT NULL", "has_payload")
            .where("j.id = :jobId", { jobId })
            .getRawAndEntities();
        const entity = job.entities[0];
        const raw = job.raw[0] as { has_payload?: boolean } | undefined;
        if (!entity || (userId && entity.userId !== userId)) {
            throw new NotFoundException("Job not found");
        }
        if (entity.status !== JobStatus.Failed) {
            throw new BadRequestException("Only failed jobs can be retried");
        }
        if (!raw?.has_payload) {
            throw new GoneException("The audio fragment is no longer stored; upload it again");
        }
        if (userId) await this.assertWithinLimit(entity.userId, this.jobs);

        await this.jobs.update(entity.id, {
            status: JobStatus.Queued,
            error: null,
            startedAt: null,
            finishedAt: null,
            notified: false,
        });
        return this.toDto({ ...entity, status: JobStatus.Queued, error: null, finishedAt: null });
    }

    // ── Reading ──────────────────────────────────────────────────────────────

    async getJobs(userId: string, ids: string[]): Promise<JobDto[]> {
        if (ids.length === 0) return [];
        const jobs = await this.jobs.find({ where: { userId, id: In(ids) } });
        return this.withResults(jobs);
    }

    async recentJobs(userId: string, limit = 50): Promise<JobDto[]> {
        const jobs = await this.jobs.find({
            where: { userId },
            order: { createdAt: "DESC" },
            take: limit,
        });
        return jobs.map((j) => this.toDto(j));
    }

    private async withResults(jobs: AnalysisJob[]): Promise<JobDto[]> {
        const analysisIds = jobs.map((j) => j.analysisId).filter((id): id is string => !!id);
        const analyses = analysisIds.length
            ? await this.analyses.find({ where: { id: In(analysisIds) } })
            : [];
        const byId = new Map(analyses.map((a) => [a.id, a]));
        return jobs.map((j) =>
            this.toDto(j, j.analysisId ? (byId.get(j.analysisId)?.result ?? null) : null)
        );
    }

    toDto(job: AnalysisJob, result?: Record<string, unknown> | null): JobDto {
        const dto: JobDto = {
            id: job.id,
            trackId: job.clientTrackId,
            status: job.status,
            error: job.error,
            fromCache: job.fromCache,
            fingerprint: job.fingerprint,
            modelVersion: job.modelVersion,
            createdAt: job.createdAt,
            finishedAt: job.finishedAt,
        };
        if (result !== undefined) dto.result = result;
        return dto;
    }

    async modelInfo() {
        const active = await this.modelsService.getActive();
        return {
            version: active?.version ?? (await this.modelsService.getActiveVersion()),
            activatedAt: active?.activatedAt ?? null,
            accuracy: active?.metrics?.accuracy ?? null,
            labels: active?.metrics?.labels ?? [],
        };
    }

    // ── Similar tracks ───────────────────────────────────────────────────────

    async similar(fingerprint: string, candidates: string[], limit: number) {
        const unique = [...new Set(candidates.filter((c) => c && c !== fingerprint))];
        if (unique.length === 0) return [];
        const rows = await this.analyses
            .createQueryBuilder("a")
            .select(["a.fingerprint", "a.createdAt"])
            .addSelect("a.embedding")
            .where("a.fingerprint IN (:...fps)", { fps: [fingerprint, ...unique] })
            .andWhere("a.embedding IS NOT NULL")
            .orderBy("a.createdAt", "DESC")
            .getMany();

        const embeddings = new Map<string, number[]>();
        for (const row of rows) {
            if (row.embedding && !embeddings.has(row.fingerprint)) {
                embeddings.set(row.fingerprint, row.embedding);
            }
        }
        const target = embeddings.get(fingerprint);
        if (!target) throw new NotFoundException("The track has not been analysed yet");

        return unique
            .filter((fp) => embeddings.has(fp))
            .map((fp) => ({
                fingerprint: fp,
                score: Math.round(cosineSimilarity(target, embeddings.get(fp)!) * 1000) / 1000,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}
