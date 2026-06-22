import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { LocalAuthGuard } from "../common/guards/local-auth.guard";
import { JwtRefreshGuard } from "../common/guards/jwt-refresh.guard";
import type { User } from "../users/entities/user.entity";
import type { AuthenticatedUser } from "./strategies/jwt.strategy";

/** Stricter rate limit for auth endpoints: 10 requests per minute. */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags("auth")
@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // ── Public endpoints ─────────────────────────────────────────────────────

    @Public()
    @Throttle(AUTH_THROTTLE)
    @Post("register")
    @ApiOperation({ summary: "Register a new user" })
    @ApiResponse({ status: 201, description: "Returns access + refresh tokens." })
    @ApiResponse({ status: 409, description: "Email already registered." })
    register(@Body() dto: RegisterDto, @Req() req: Request) {
        return this.authService.register(dto, req);
    }

    @Public()
    @Throttle(AUTH_THROTTLE)
    @UseGuards(LocalAuthGuard)
    @Post("login")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Login with email + password" })
    @ApiResponse({ status: 200, description: "Returns access + refresh tokens." })
    @ApiResponse({ status: 401, description: "Invalid credentials." })
    // LoginDto is consumed by LocalStrategy; document it for Swagger
    login(
        @CurrentUser() user: User,
        @Req() req: Request & { body: LoginDto },
        // LoginDto param is included so Swagger can reflect the request body schema
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        @Body() _dto: LoginDto
    ) {
        return this.authService.login(user, req);
    }

    @Public()
    @UseGuards(JwtRefreshGuard)
    @Post("refresh")
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Rotate tokens using a refresh token" })
    @ApiResponse({ status: 200, description: "Returns a new access + refresh token pair." })
    @ApiResponse({ status: 401, description: "Invalid or expired refresh token." })
    refresh(@CurrentUser() user: { id: string; sessionId: string }) {
        return this.authService.refresh(user.id, user.sessionId);
    }

    // ── Protected endpoints ──────────────────────────────────────────────────

    @Get("me")
    @ApiBearerAuth()
    @ApiOperation({ summary: "Get the current authenticated user" })
    @ApiResponse({ status: 200 })
    me(@CurrentUser() user: AuthenticatedUser) {
        return { id: user.id, email: user.email, sessionId: user.sessionId };
    }

    @Post("logout")
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Logout current session" })
    async logout(@CurrentUser() user: AuthenticatedUser) {
        await this.authService.logout(user.sessionId);
        return { message: "Logged out successfully" };
    }

    @Delete("sessions")
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Logout all sessions (all devices)" })
    async logoutAll(@CurrentUser() user: AuthenticatedUser) {
        await this.authService.logoutAll(user.id);
        return { message: "All sessions terminated" };
    }
}
