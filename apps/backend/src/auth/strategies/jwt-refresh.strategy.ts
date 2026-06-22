import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import * as bcrypt from "bcrypt";
import { SessionsService } from "../../sessions/sessions.service";

export interface JwtRefreshPayload {
    sub: string;
    sessionId: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
    constructor(
        configService: ConfigService,
        private readonly sessionsService: SessionsService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
            passReqToCallback: true,
        });
    }

    async validate(
        req: Request,
        payload: JwtRefreshPayload
    ): Promise<{ id: string; sessionId: string }> {
        const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (!rawToken) throw new UnauthorizedException();

        const session = await this.sessionsService.findById(payload.sessionId);

        if (!session || session.userId !== payload.sub || new Date() > session.expiresAt) {
            throw new UnauthorizedException("Session expired or not found");
        }

        const tokenMatches = await bcrypt.compare(rawToken, session.refreshTokenHash);
        if (!tokenMatches) {
            // Possible token reuse — invalidate the session for security
            await this.sessionsService.delete(payload.sessionId);
            throw new UnauthorizedException("Refresh token reuse detected");
        }

        return { id: payload.sub, sessionId: payload.sessionId };
    }
}
