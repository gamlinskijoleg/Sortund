import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface JwtPayload {
    /** User UUID */
    sub: string;
    email: string;
    /** Session UUID — present in the access token so logout can target a session. */
    sessionId: string;
}

export interface AuthenticatedUser {
    id: string;
    email: string;
    sessionId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
        });
    }

    /** Return value becomes request.user for downstream handlers. */
    validate(payload: JwtPayload): AuthenticatedUser {
        return {
            id: payload.sub,
            email: payload.email,
            sessionId: payload.sessionId,
        };
    }
}
