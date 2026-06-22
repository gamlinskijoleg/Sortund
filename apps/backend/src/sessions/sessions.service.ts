import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { Session } from "./entities/session.entity";

const BCRYPT_ROUNDS = 10; // lower than password: speed matters more for refresh tokens

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
        const refreshTokenHash = await bcrypt.hash(params.refreshToken, BCRYPT_ROUNDS);
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
        const newHash = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);
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
