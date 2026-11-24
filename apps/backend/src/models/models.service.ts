import {
    BadGatewayException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { AiWorkerClient, WorkerError } from "../ai-worker/ai-worker.client";
import { ModelMetrics, ModelVersion } from "./entities/model-version.entity";
import {
    Correction,
    CorrectionField,
    CorrectionStatus,
} from "../corrections/entities/correction.entity";
import { TrackAnalysis } from "../analysis/entities/track-analysis.entity";

export const DEFAULT_MODEL_VERSION = "v1";
const SEED_RETRY_MS = 60_000;

export interface ModelComparison {
    canActivate: boolean;
    accuracyDelta: number | null;
    macroF1Delta: number | null;
}

/** New metrics must not be worse than the active ones (REQ 75). */
export function compareMetrics(
    candidate: ModelMetrics | null,
    active: ModelMetrics | null
): ModelComparison {
    if (!candidate) return { canActivate: false, accuracyDelta: null, macroF1Delta: null };
    if (!active) return { canActivate: true, accuracyDelta: null, macroF1Delta: null };
    const accuracyDelta = candidate.accuracy - active.accuracy;
    const macroF1Delta = candidate.macro_f1 - active.macro_f1;
    const eps = 1e-9;
    return {
        canActivate: accuracyDelta >= -eps && macroF1Delta >= -eps,
        accuracyDelta: Math.round(accuracyDelta * 10000) / 10000,
        macroF1Delta: Math.round(macroF1Delta * 10000) / 10000,
    };
}

@Injectable()
export class ModelsService implements OnApplicationBootstrap {
    private readonly logger = new Logger(ModelsService.name);
    private activeCache: ModelVersion | null = null;
    private lastSeedAttempt = 0;

    constructor(
        @InjectRepository(ModelVersion)
        private readonly versions: Repository<ModelVersion>,
        @InjectRepository(Correction)
        private readonly corrections: Repository<Correction>,
        @InjectRepository(TrackAnalysis)
        private readonly analyses: Repository<TrackAnalysis>,
        private readonly worker: AiWorkerClient,
        private readonly dataSource: DataSource
    ) {}

    onApplicationBootstrap(): void {
        // Fire and forget: the worker may still be starting.
        void this.seedFromWorker();
    }

    /** Imports model versions that exist on the worker but not yet in the database. */
    async seedFromWorker(): Promise<void> {
        this.lastSeedAttempt = Date.now();
        try {
            const remote = await this.worker.listModels();
            const known = new Set((await this.versions.find()).map((v) => v.version));
            for (const model of remote) {
                if (known.has(model.version)) continue;
                const exported = await this.worker.exportModel(model.version);
                await this.versions.save(
                    this.versions.create({
                        version: model.version,
                        metrics: exported.metrics,
                        weights: Buffer.from(exported.weights_b64, "base64"),
                        isActive: false,
                        correctionsUsed: exported.metrics?.corrections_used ?? 0,
                    })
                );
                this.logger.log(`Imported genre model ${model.version} from the AI worker`);
            }
            const active = await this.versions.findOne({ where: { isActive: true } });
            if (!active) {
                const fallback =
                    (await this.versions.findOne({ where: { version: DEFAULT_MODEL_VERSION } })) ??
                    (await this.versions.findOne({ where: {}, order: { createdAt: "ASC" } }));
                if (fallback) {
                    await this.versions.update(fallback.id, {
                        isActive: true,
                        activatedAt: new Date(),
                    });
                    this.logger.log(`Activated genre model ${fallback.version}`);
                }
            }
            this.activeCache = null;
        } catch (error) {
            this.logger.warn(`Could not sync model versions with the AI worker: ${String(error)}`);
        }
    }

    async getActive(): Promise<ModelVersion | null> {
        if (this.activeCache) return this.activeCache;
        const active = await this.versions.findOne({ where: { isActive: true } });
        if (!active && Date.now() - this.lastSeedAttempt > SEED_RETRY_MS) {
            await this.seedFromWorker();
            return this.versions.findOne({ where: { isActive: true } });
        }
        this.activeCache = active;
        return active;
    }

    async getActiveVersion(): Promise<string> {
        return (await this.getActive())?.version ?? DEFAULT_MODEL_VERSION;
    }

    /** Re-uploads stored weights when the worker lost a version (e.g. after a redeploy). */
    async restoreOnWorker(version: string): Promise<boolean> {
        const model = await this.versions
            .createQueryBuilder("m")
            .addSelect("m.weights")
            .where("m.version = :version", { version })
            .getOne();
        if (!model?.weights) return false;
        await this.worker.uploadModel(version, model.weights, model.metrics);
        return true;
    }

    async list() {
        const [all, active] = await Promise.all([
            this.versions.find({ order: { createdAt: "DESC" } }),
            this.getActive(),
        ]);
        return all.map((v) => ({
            id: v.id,
            version: v.version,
            isActive: v.isActive,
            metrics: v.metrics,
            correctionsUsed: v.correctionsUsed,
            createdAt: v.createdAt,
            activatedAt: v.activatedAt,
            comparison: v.isActive ? null : compareMetrics(v.metrics, active?.metrics ?? null),
        }));
    }

    private async nextVersionName(): Promise<string> {
        const names = (await this.versions.find({ select: { version: true } })).map(
            (v) => v.version
        );
        const max = names
            .map((n) => /^v(\d+)$/.exec(n)?.[1])
            .filter((n): n is string => !!n)
            .reduce((acc, n) => Math.max(acc, parseInt(n, 10)), 0);
        return `v${max + 1}`;
    }

    /** Trains a new version on the approved genre corrections (REQ 73). */
    async train() {
        const approved = await this.corrections.find({
            where: { field: CorrectionField.Genre, status: CorrectionStatus.Approved },
            order: { createdAt: "ASC" },
        });

        // Latest correction per (user, track) wins.
        const latest = new Map<string, Correction>();
        for (const c of approved) latest.set(`${c.userId}:${c.fingerprint}`, c);

        const fingerprints = [...new Set([...latest.values()].map((c) => c.fingerprint))];
        const featureRows = fingerprints.length
            ? await this.analyses
                  .createQueryBuilder("a")
                  .select(["a.fingerprint", "a.createdAt"])
                  .addSelect("a.features")
                  .where("a.fingerprint IN (:...fingerprints)", { fingerprints })
                  .andWhere("a.features IS NOT NULL")
                  .orderBy("a.createdAt", "DESC")
                  .getMany()
            : [];
        const featuresByFingerprint = new Map<string, number[]>();
        for (const row of featureRows) {
            if (row.features && !featuresByFingerprint.has(row.fingerprint)) {
                featuresByFingerprint.set(row.fingerprint, row.features);
            }
        }

        const samples: { features: number[]; label: string }[] = [];
        const usedIds: string[] = [];
        for (const c of latest.values()) {
            const features = featuresByFingerprint.get(c.fingerprint);
            if (!features) continue;
            samples.push({ features, label: c.newValue.toLowerCase() });
            usedIds.push(c.id);
        }

        const version = await this.nextVersionName();
        let trained;
        try {
            trained = await this.worker.train(version, samples);
        } catch (error) {
            if (error instanceof WorkerError) throw new BadGatewayException(error.message);
            throw error;
        }

        const labels = new Set(trained.metrics.labels);
        const byId = new Map([...latest.values()].map((c) => [c.id, c]));
        const actuallyUsed = usedIds.filter((id) => {
            const c = byId.get(id);
            return !!c && labels.has(c.newValue.toLowerCase());
        });

        const saved = await this.dataSource.transaction(async (manager) => {
            const entity = await manager.save(
                manager.create(ModelVersion, {
                    version,
                    metrics: trained.metrics,
                    weights: Buffer.from(trained.weights_b64, "base64"),
                    isActive: false,
                    correctionsUsed: trained.metrics.corrections_used ?? actuallyUsed.length,
                })
            );
            if (actuallyUsed.length) {
                await manager.update(
                    Correction,
                    { id: In(actuallyUsed) },
                    { usedInVersion: version }
                );
            }
            return entity;
        });

        const active = await this.getActive();
        this.logger.log(
            `Trained genre model ${version} on ${samples.length} correction(s): ` +
                `accuracy=${trained.metrics.accuracy} macro_f1=${trained.metrics.macro_f1}`
        );
        return {
            id: saved.id,
            version,
            metrics: trained.metrics,
            correctionsUsed: saved.correctionsUsed,
            comparison: compareMetrics(trained.metrics, active?.metrics ?? null),
        };
    }

    /** Activates a version only if its metrics are not worse than the active one (REQ 75). */
    async activate(id: string) {
        const candidate = await this.versions.findOne({ where: { id } });
        if (!candidate) throw new NotFoundException("Model version not found");
        if (candidate.isActive) return { version: candidate.version, isActive: true };

        const active = await this.getActive();
        const comparison = compareMetrics(candidate.metrics, active?.metrics ?? null);
        if (!comparison.canActivate) {
            throw new ConflictException({
                message: "The candidate model is worse than the active one and cannot be activated",
                comparison,
            });
        }

        await this.dataSource.transaction(async (manager) => {
            await manager.update(ModelVersion, { isActive: true }, { isActive: false });
            await manager.update(ModelVersion, candidate.id, {
                isActive: true,
                activatedAt: new Date(),
            });
        });
        this.activeCache = null;
        this.logger.log(`Activated genre model ${candidate.version}`);
        return { version: candidate.version, isActive: true, comparison };
    }
}
