import {
    ForbiddenException,
    HttpException,
    HttpStatus,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { UsersService } from "../users/users.service";
import { SessionsService } from "../sessions/sessions.service";
import { User } from "../users/entities/user.entity";
import { RegisterDto } from "./dto/register.dto";
import { remainingLockMs } from "./login-lockout";

/** bcrypt hash of a random string, compared against when the e-mail is unknown. */
const DUMMY_PASSWORD_HASH = "$2b$12$cb6fMYZE4rVlMiggofyeQOqG.9C.6ykENU9blUckuj76a6MhTGNue";

function tooManyAttempts(waitMs: number): HttpException {
    const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
    return new HttpException(
        { statusCode: 429, message: "Too many failed login attempts", retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS
    );
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly sessionsService: SessionsService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService
    ) {}

    // ── Public methods ───────────────────────────────────────────────────────

    async register(dto: RegisterDto, req: Request): Promise<TokenPair> {
        const user = await this.usersService.create(dto.email, dto.password);
        return this.issueSession(user, req);
    }

    async login(user: User, req: Request): Promise<TokenPair> {
        return this.issueSession(user, req);
    }

    /**
     * Validates email + password. Returns the User if valid, null otherwise.
     * Called by LocalStrategy.
     */
    async validateUser(email: string, password: string): Promise<User | null> {
        const user = await this.usersService.findByEmail(email.trim().toLowerCase());
        if (!user) {
            // Same bcrypt cost as for a real account, so response time does not reveal which
            // e-mails are registered.
            await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
            return null;
        }

        // A locked account is refused before the password is checked: guesses made during the
        // lock reveal nothing (REQ 5; see login-lockout.ts).
        const waitMs = remainingLockMs(user.lockedUntil, new Date());
        if (waitMs > 0) throw tooManyAttempts(waitMs);

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) {
            const { lockedUntil } = await this.usersService.registerFailedLogin(user.id);
            if (lockedUntil) throw tooManyAttempts(lockedUntil.getTime() - Date.now());
            return null;
        }
        if (user.failedLoginCount > 0 || user.lockedUntil) {
            await this.usersService.resetFailedLogins(user.id);
        }
        return user;
    }

    /**
     * Issue a rotated access + refresh token pair for an existing session.
     * The old refresh token is immediately invalidated (hash replaced in DB).
     */
    async refresh(userId: string, sessionId: string): Promise<TokenPair> {
        const user = await this.usersService.findById(userId);
        if (!user) throw new UnauthorizedException();
        if (user.isBlocked) {
            await this.sessionsService.delete(sessionId);
            throw new ForbiddenException("Account is blocked");
        }

        const refreshExpiresIn = this.configService.getOrThrow<string>("JWT_REFRESH_EXPIRES_IN");
        const expiresAt = this.parseExpiry(refreshExpiresIn);

        const [accessToken, refreshToken] = await Promise.all([
            this.signAccess(user.id, user.email, sessionId),
            this.signRefresh(user.id, sessionId, refreshExpiresIn),
        ]);

        // Rotate — old token's hash is overwritten; replaying it will fail
        await this.sessionsService.rotate(sessionId, refreshToken, expiresAt);

        return { accessToken, refreshToken };
    }

    async logout(sessionId: string): Promise<void> {
        await this.sessionsService.delete(sessionId);
    }

    async logoutAll(userId: string): Promise<void> {
        await this.sessionsService.deleteAllForUser(userId);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Create a brand-new session and return the initial token pair.
     * We pre-generate the sessionId so we can embed it in both JWTs and the
     * session row in a single step (no two-round-trip DB dance).
     */
    private async issueSession(user: User, req: Request): Promise<TokenPair> {
        const sessionId = randomUUID();
        const refreshExpiresIn = this.configService.getOrThrow<string>("JWT_REFRESH_EXPIRES_IN");
        const expiresAt = this.parseExpiry(refreshExpiresIn);

        const [accessToken, refreshToken] = await Promise.all([
            this.signAccess(user.id, user.email, sessionId),
            this.signRefresh(user.id, sessionId, refreshExpiresIn),
        ]);

        await this.sessionsService.create({
            id: sessionId,
            userId: user.id,
            refreshToken,
            expiresAt,
            userAgent: req.headers["user-agent"],
            ipAddress: req.ip,
        });

        return { accessToken, refreshToken };
    }

    private signAccess(userId: string, email: string, sessionId: string) {
        return this.jwtService.signAsync(
            // jti makes every token unique even when two are issued within the same second.
            { sub: userId, email, sessionId, jti: randomUUID() },
            {
                secret: this.configService.getOrThrow<string>("JWT_SECRET"),
                // ConfigService returns string; cast to satisfy @nestjs/jwt's StringValue type.

                expiresIn: this.configService.get("JWT_EXPIRES_IN", "15m"),
            }
        );
    }

    private signRefresh(userId: string, sessionId: string, expiresIn: string) {
        return this.jwtService.signAsync(
            { sub: userId, sessionId, jti: randomUUID() },
            {
                secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),

                expiresIn: expiresIn as any,
            }
        );
    }

    /** Parse duration strings like '7d', '15m', '1h', '30s' into a future Date. */
    private parseExpiry(expiresIn: string): Date {
        const units: Record<string, number> = {
            d: 86_400_000,
            h: 3_600_000,
            m: 60_000,
            s: 1_000,
        };
        const match = expiresIn.match(/^(\d+)([dhms])$/);
        if (!match || !match[1] || !match[2]) {
            throw new Error(`Invalid JWT expiry format: "${expiresIn}"`);
        }
        const amount = parseInt(match[1], 10);
        const multiplier = units[match[2]] ?? 1_000;
        return new Date(Date.now() + amount * multiplier);
    }
}
