import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { UsersService } from "../users/users.service";
import { SessionsService } from "../sessions/sessions.service";
import { User, UserRole } from "../users/entities/user.entity";
import { AnalysisJob, JobStatus } from "../analysis/entities/analysis-job.entity";
import { monthBounds } from "../analysis/analysis.service";

@Injectable()
export class AdminService {
    constructor(
        private readonly usersService: UsersService,
        private readonly sessionsService: SessionsService,
        @InjectRepository(AnalysisJob)
        private readonly jobs: Repository<AnalysisJob>,
        private readonly dataSource: DataSource
    ) {}

    // ── Users (REQ 66–68) ────────────────────────────────────────────────────

    async listUsers(search: string | undefined, page: number, pageSize: number) {
        const { items, total } = await this.usersService.list({ search, page, pageSize });
        const usage = await this.usageByUser(items.map((u) => u.id));
        return {
            items: items.map((u) => ({
                id: u.id,
                email: u.email,
                role: u.role,
                monthlyAnalysisLimit: u.monthlyAnalysisLimit,
                isBlocked: u.isBlocked,
                createdAt: u.createdAt,
                usedThisMonth: usage.get(u.id) ?? 0,
            })),
            total,
            page,
            pageSize,
        };
    }

    private async usageByUser(userIds: string[]): Promise<Map<string, number>> {
        if (userIds.length === 0) return new Map();
        const { start } = monthBounds();
        const rows = await this.jobs
            .createQueryBuilder("j")
            .select("j.user_id", "userId")
            .addSelect("COUNT(*)::int", "count")
            .where("j.user_id IN (:...userIds)", { userIds })
            .andWhere("j.counts_toward_limit = true")
            .andWhere("j.finished_at >= :start", { start })
            .groupBy("j.user_id")
            .getRawMany<{ userId: string; count: number }>();
        return new Map(rows.map((r) => [r.userId, Number(r.count)]));
    }

    async updateUser(
        actorId: string,
        id: string,
        changes: { role?: UserRole; monthlyAnalysisLimit?: number; isBlocked?: boolean }
    ) {
        const user = await this.usersService.findById(id);
        if (!user) throw new NotFoundException("User not found");
        if (id === actorId && (changes.isBlocked === true || changes.role === UserRole.User)) {
            throw new BadRequestException("You cannot block or demote yourself");
        }
        const updated = (await this.usersService.update(id, changes)) as User;
        if (changes.isBlocked) {
            // Blocked users are logged out everywhere immediately.
            await this.sessionsService.deleteAllForUser(id);
        }
        return {
            id: updated.id,
            email: updated.email,
            role: updated.role,
            monthlyAnalysisLimit: updated.monthlyAnalysisLimit,
            isBlocked: updated.isBlocked,
        };
    }

    // ── Queue monitoring (REQ 69–70) ─────────────────────────────────────────

    async queueCounts() {
        const rows = await this.jobs
            .createQueryBuilder("j")
            .select("j.status", "status")
            .addSelect("COUNT(*)::int", "count")
            .groupBy("j.status")
            .getRawMany<{ status: JobStatus; count: number }>();
        const counts: Record<JobStatus, number> = {
            [JobStatus.Queued]: 0,
            [JobStatus.Processing]: 0,
            [JobStatus.Done]: 0,
            [JobStatus.Failed]: 0,
        };
        for (const row of rows) counts[row.status] = Number(row.count);
        return counts;
    }

    async listJobs(status: JobStatus | undefined, page: number, pageSize: number) {
        const qb = this.jobs
            .createQueryBuilder("j")
            .leftJoin(User, "u", "u.id = j.user_id")
            .addSelect("u.email", "email")
            .orderBy("j.created_at", "DESC")
            .offset((page - 1) * pageSize)
            .limit(pageSize);
        if (status) qb.where("j.status = :status", { status });
        const [{ entities, raw }, total] = await Promise.all([
            qb.getRawAndEntities(),
            qb.getCount(),
        ]);
        return {
            items: entities.map((j, i) => ({
                id: j.id,
                email: (raw[i] as { email?: string } | undefined)?.email ?? null,
                filename: j.filename,
                status: j.status,
                error: j.error,
                attempts: j.attempts,
                fromCache: j.fromCache,
                durationMs: j.durationMs,
                createdAt: j.createdAt,
                finishedAt: j.finishedAt,
            })),
            total,
            page,
            pageSize,
        };
    }

    async retryAllFailed(): Promise<{ requeued: number }> {
        const result = await this.jobs
            .createQueryBuilder()
            .update(AnalysisJob)
            .set({
                status: JobStatus.Queued,
                error: null,
                startedAt: null,
                finishedAt: null,
                notified: false,
            })
            .where("status = :failed", { failed: JobStatus.Failed })
            .andWhere("payload IS NOT NULL")
            .execute();
        return { requeued: result.affected ?? 0 };
    }

    // ── Service statistics (REQ 71) ──────────────────────────────────────────

    async stats(days: number) {
        const since = new Date(Date.now() - days * 86_400_000);
        since.setUTCHours(0, 0, 0, 0);

        const [usersTotal, perDay, newUsers, totals, topGenres, queue] = await Promise.all([
            this.usersService.count(),
            this.dataSource.query<
                { day: string; total: number; from_cache: number; active_users: number }[]
            >(
                `SELECT to_char(date_trunc('day', finished_at), 'YYYY-MM-DD') AS day,
                        COUNT(*)::int AS total,
                        COUNT(*) FILTER (WHERE from_cache)::int AS from_cache,
                        COUNT(DISTINCT user_id)::int AS active_users
                 FROM analysis_jobs
                 WHERE status = 'done' AND finished_at >= $1
                 GROUP BY 1 ORDER BY 1`,
                [since]
            ),
            this.dataSource.query<{ day: string; count: number }[]>(
                `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
                 FROM users WHERE created_at >= $1 GROUP BY 1 ORDER BY 1`,
                [since]
            ),
            this.dataSource.query<
                { total: number; from_cache: number; avg_ms: number; avg_cache_ms: number }[]
            >(
                `SELECT COUNT(*)::int AS total,
                        COUNT(*) FILTER (WHERE from_cache)::int AS from_cache,
                        COALESCE(AVG(duration_ms) FILTER (WHERE NOT from_cache), 0)::int AS avg_ms,
                        COALESCE(AVG(duration_ms) FILTER (WHERE from_cache), 0)::int AS avg_cache_ms
                 FROM analysis_jobs WHERE status = 'done' AND finished_at >= $1`,
                [since]
            ),
            this.dataSource.query<{ genre: string; count: number }[]>(
                `SELECT a.genre, COUNT(*)::int AS count
                 FROM analysis_jobs j JOIN track_analyses a ON a.id = j.analysis_id
                 WHERE j.status = 'done' AND a.genre IS NOT NULL
                 GROUP BY a.genre ORDER BY count DESC LIMIT 10`
            ),
            this.queueCounts(),
        ]);

        const days_: string[] = [];
        for (let d = new Date(since); d <= new Date(); d = new Date(d.getTime() + 86_400_000)) {
            days_.push(d.toISOString().slice(0, 10));
        }
        const perDayMap = new Map(perDay.map((r) => [r.day, r]));
        const newUsersMap = new Map(newUsers.map((r) => [r.day, r.count]));
        const total = totals[0] ?? { total: 0, from_cache: 0, avg_ms: 0, avg_cache_ms: 0 };

        return {
            usersTotal,
            days: days_.map((day) => ({
                day,
                analyses: perDayMap.get(day)?.total ?? 0,
                fromCache: perDayMap.get(day)?.from_cache ?? 0,
                activeUsers: perDayMap.get(day)?.active_users ?? 0,
                newUsers: newUsersMap.get(day) ?? 0,
            })),
            analysesTotal: total.total,
            cacheHitRatio: total.total
                ? Math.round((total.from_cache / total.total) * 1000) / 1000
                : 0,
            avgAnalysisMs: total.avg_ms,
            avgCacheMs: total.avg_cache_ms,
            topGenres,
            queue,
        };
    }
}
