import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Correction, CorrectionField, CorrectionStatus } from "./entities/correction.entity";
import { User } from "../users/entities/user.entity";
import { TrackAnalysis } from "../analysis/entities/track-analysis.entity";
import { ModelsService } from "../models/models.service";

export interface CorrectionListQuery {
    status?: CorrectionStatus;
    field?: CorrectionField;
    page: number;
    pageSize: number;
}

@Injectable()
export class CorrectionsService {
    constructor(
        @InjectRepository(Correction)
        private readonly corrections: Repository<Correction>,
        @InjectRepository(TrackAnalysis)
        private readonly analyses: Repository<TrackAnalysis>,
        private readonly modelsService: ModelsService
    ) {}

    async create(
        userId: string,
        dto: {
            fingerprint: string;
            field: CorrectionField;
            oldValue?: string | null;
            newValue: string;
        }
    ): Promise<Correction> {
        const newValue = dto.newValue.trim();
        // Re-submitting the same fix for the same track replaces the previous pending one.
        const existing = await this.corrections.findOne({
            where: {
                userId,
                fingerprint: dto.fingerprint,
                field: dto.field,
                status: CorrectionStatus.Pending,
            },
        });
        if (existing) {
            existing.newValue = newValue;
            existing.oldValue = dto.oldValue ?? existing.oldValue;
            return this.corrections.save(existing);
        }
        return this.corrections.save(
            this.corrections.create({
                userId,
                fingerprint: dto.fingerprint,
                field: dto.field,
                oldValue: dto.oldValue ?? null,
                newValue,
            })
        );
    }

    /** Admin list with flags telling whether a correction can be used for training. */
    async list(query: CorrectionListQuery) {
        const qb = this.corrections
            .createQueryBuilder("c")
            .leftJoin(User, "u", "u.id = c.user_id")
            .addSelect("u.email", "email")
            .orderBy("c.created_at", "DESC")
            .offset((query.page - 1) * query.pageSize)
            .limit(query.pageSize);
        if (query.status) qb.andWhere("c.status = :status", { status: query.status });
        if (query.field) qb.andWhere("c.field = :field", { field: query.field });

        const [{ entities, raw }, total] = await Promise.all([
            qb.getRawAndEntities(),
            qb.getCount(),
        ]);

        const fingerprints = [...new Set(entities.map((c) => c.fingerprint))];
        const withFeatures = new Set<string>();
        const titles = new Map<string, string>();
        if (fingerprints.length) {
            const rows = await this.analyses
                .createQueryBuilder("a")
                .select(["a.fingerprint", "a.result"])
                .addSelect("a.features IS NOT NULL", "has_features")
                .where("a.fingerprint IN (:...fingerprints)", { fingerprints })
                .getRawMany<{
                    a_fingerprint: string;
                    a_result: Record<string, unknown>;
                    has_features: boolean;
                }>();
            for (const row of rows) {
                if (row.has_features) withFeatures.add(row.a_fingerprint);
                const r = row.a_result;
                if (r && !titles.has(row.a_fingerprint)) {
                    const artist = typeof r.artist === "string" ? r.artist : "?";
                    const title = typeof r.title === "string" ? r.title : "?";
                    titles.set(row.a_fingerprint, `${artist} — ${title}`);
                }
            }
        }

        const active = await this.modelsService.getActive();
        const labels = new Set(active?.metrics?.labels ?? []);

        const items = entities.map((c, i) => ({
            ...c,
            email: (raw[i] as { email?: string } | undefined)?.email ?? null,
            track: titles.get(c.fingerprint) ?? null,
            usableForTraining:
                c.field === CorrectionField.Genre &&
                withFeatures.has(c.fingerprint) &&
                labels.has(c.newValue.toLowerCase()),
        }));
        return { items, total, labels: [...labels] };
    }

    async setStatus(id: string, status: CorrectionStatus): Promise<Correction> {
        const correction = await this.corrections.findOne({ where: { id } });
        if (!correction) throw new NotFoundException("Correction not found");
        correction.status = status;
        return this.corrections.save(correction);
    }
}
