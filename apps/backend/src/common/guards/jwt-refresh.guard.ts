import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Validates the long-lived refresh JWT via JwtRefreshStrategy. */
@Injectable()
export class JwtRefreshGuard extends AuthGuard("jwt-refresh") {}
