import { ConflictException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, In, Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User, UserRole } from "./entities/user.entity";
import { lockDurationMs } from "../auth/login-lockout";

const BCRYPT_ROUNDS = 12;

export interface UserListQuery {
    search?: string;
    page: number;
    pageSize: number;
}

@Injectable()
export class UsersService implements OnModuleInit {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
        private readonly configService: ConfigService
    ) {}

    /** Promotes the e-mails listed in ADMIN_EMAILS to admins (idempotent). */
    async onModuleInit(): Promise<void> {
        const emails = this.adminEmails();
        if (emails.length === 0) return;
        try {
            const result = await this.usersRepository.update(
                { email: In(emails), role: UserRole.User },
                { role: UserRole.Admin }
            );
            if (result.affected) this.logger.log(`Promoted ${result.affected} user(s) to admin`);
        } catch (error) {
            this.logger.warn(`Could not promote admin users: ${String(error)}`);
        }
    }

    private adminEmails(): string[] {
        return (this.configService.get<string>("ADMIN_EMAILS") ?? "")
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
    }

    async create(email: string, password: string): Promise<User> {
        const normalized = email.trim().toLowerCase();
        const existing = await this.usersRepository.findOne({ where: { email: normalized } });
        if (existing) {
            throw new ConflictException("Email is already registered");
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const user = this.usersRepository.create({
            email: normalized,
            passwordHash,
            role: this.adminEmails().includes(normalized) ? UserRole.Admin : UserRole.User,
            monthlyAnalysisLimit: this.configService.get<number>(
                "DEFAULT_MONTHLY_ANALYSIS_LIMIT",
                100
            ),
        });
        return this.usersRepository.save(user);
    }

    findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    /**
     * Counts a failed login and locks the account when the free attempts are used up.
     * The counter is incremented in SQL, so parallel attempts cannot overwrite each other.
     */
    async registerFailedLogin(
        userId: string
    ): Promise<{ failedCount: number; lockedUntil: Date | null }> {
        const result: unknown = await this.usersRepository.query(
            `UPDATE users SET failed_login_count = failed_login_count + 1
             WHERE id = $1 RETURNING failed_login_count`,
            [userId]
        );
        // For UPDATE … RETURNING the Postgres driver of TypeORM returns [rows, affectedCount].
        const rows = (Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result) as {
            failed_login_count: number;
        }[];
        const failedCount = Number(rows[0]?.failed_login_count ?? 0);
        const lockMs = lockDurationMs(failedCount);
        if (lockMs === 0) return { failedCount, lockedUntil: null };
        const lockedUntil = new Date(Date.now() + lockMs);
        await this.usersRepository.update(userId, { lockedUntil });
        return { failedCount, lockedUntil };
    }

    async resetFailedLogins(userId: string): Promise<void> {
        await this.usersRepository.update(userId, { failedLoginCount: 0, lockedUntil: null });
    }

    findById(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async list(query: UserListQuery): Promise<{ items: User[]; total: number }> {
        const where = query.search ? { email: ILike(`%${query.search.trim()}%`) } : {};
        const [items, total] = await this.usersRepository.findAndCount({
            where,
            order: { createdAt: "DESC" },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
        });
        return { items, total };
    }

    async update(
        id: string,
        changes: Partial<Pick<User, "role" | "monthlyAnalysisLimit" | "isBlocked">>
    ): Promise<User | null> {
        await this.usersRepository.update(id, changes);
        return this.findById(id);
    }

    async setPushToken(id: string, token: string | null): Promise<void> {
        // A device token belongs to one account at a time.
        if (token) await this.usersRepository.update({ pushToken: token }, { pushToken: null });
        await this.usersRepository.update(id, { pushToken: token });
    }

    count(): Promise<number> {
        return this.usersRepository.count();
    }
}
