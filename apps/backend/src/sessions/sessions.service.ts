import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { createHash, timingSafeEqual } from "crypto";
import { Session } from "./entities/session.entity";

/**
 * Refresh tokens are long random-looking JWTs, so a fast SHA-256 digest is sufficient.
 * bcrypt must NOT be used here: it only looks at the first 72 bytes, and those bytes
 * (JWT header + start of the payload) are identical for every token of one session,
 * which would make rotated-out tokens still match.
 */
export function hashRefreshToken(token: string): string {
    return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

export async function refreshTokenMatches(token: string, storedHash: string): Promise<boolean> {
    if (storedHash.startsWith("sha256:")) {
        const expected = Buffer.from(storedHash);
        const actual = Buffer.from(hashRefreshToken(token));
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    }
    // Legacy sessions created before the fix; replaced by a SHA-256 hash on the next rotation.
    return bcrypt.compare(token, storedHash);
}

@Injectable()
export class SessionsService {
    constructor(
        @InjectRepository(Session)
        private readonly sessionsRepository: Repository<Session>
    ) {}

    /**
     * Persist a new session. The caller must supply a pre-generated UUID so the
     * ID can be embedded in the refresh token payload before the token is signed.
     */
    async create(params: {
        id: string;
        userId: string;
        refreshToken: string;
        expiresAt: Date;
        userAgent?: string;
        ipAddress?: string;
    }): Promise<Session> {
        const refreshTokenHash = hashRefreshToken(params.refreshToken);
        const session = this.sessionsRepository.create({
            id: params.id,
            userId: params.userId,
            refreshTokenHash,
            expiresAt: params.expiresAt,
            userAgent: params.userAgent ?? null,
            ipAddress: params.ipAddress ?? null,
        });
        return this.sessionsRepository.save(session);
    }

    findById(id: string): Promise<Session | null> {
        return this.sessionsRepository.findOne({ where: { id } });
    }

    findAllByUser(userId: string): Promise<Session[]> {
        return this.sessionsRepository.find({
            where: { userId },
            order: { createdAt: "DESC" },
        });
    }

    /**
     * Rotate the refresh token in-place.
     * Called on every successful /auth/refresh so old tokens are immediately invalidated.
     */
    async rotate(sessionId: string, newRefreshToken: string, newExpiresAt: Date): Promise<void> {
        const newHash = hashRefreshToken(newRefreshToken);
        await this.sessionsRepository.update(sessionId, {
            refreshTokenHash: newHash,
            expiresAt: newExpiresAt,
        });
    }

    async delete(id: string): Promise<void> {
        await this.sessionsRepository.delete(id);
    }

    async deleteAllForUser(userId: string): Promise<void> {
        await this.sessionsRepository.delete({ userId });
    }
}
