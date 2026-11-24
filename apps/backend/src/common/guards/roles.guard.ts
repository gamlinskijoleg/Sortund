import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { UserRole } from "../../users/entities/user.entity";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";

/** Global guard; runs after JwtAuthGuard and checks @Roles() metadata. */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!roles || roles.length === 0) return true;

        const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
        if (!request.user || !roles.includes(request.user.role)) {
            throw new ForbiddenException("Insufficient permissions");
        }
        return true;
    }
}
