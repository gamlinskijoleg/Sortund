import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsersService } from "../../users/users.service";
import type { UserRole } from "../../users/entities/user.entity";

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
    role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
    constructor(
        configService: ConfigService,
        private readonly usersService: UsersService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
        });
    }

    /**
     * Return value becomes request.user. The user is re-read from the database so that
     * blocking and role changes take effect immediately, not only after the token expires.
     */
    async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
        const user = await this.usersService.findById(payload.sub);
        if (!user) throw new UnauthorizedException();
        if (user.isBlocked) throw new ForbiddenException("Account is blocked");
        return {
            id: user.id,
            email: user.email,
            sessionId: payload.sessionId,
            role: user.role,
        };
    }
}
