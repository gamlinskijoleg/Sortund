import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { SessionsModule } from "./sessions/sessions.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { envValidationSchema } from "./config/env.validation";

@Module({
    imports: [
        // ── Config ────────────────────────────────────────────────────────────
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
            validationSchema: envValidationSchema,
            validationOptions: { allowUnknown: true, abortEarly: false },
        }),

        // ── Database ──────────────────────────────────────────────────────────
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: "postgres",
                url: config.getOrThrow<string>("DATABASE_URL"),
                entities: [__dirname + "/**/*.entity{.ts,.js}"],
                migrations: [__dirname + "/database/migrations/*{.ts,.js}"],
                // Migrations run automatically on every startup — no manual step needed.
                migrationsRun: true,
                // Never auto-synchronize in any environment; always use migrations.
                synchronize: false,
                logging: config.get("NODE_ENV") === "development" ? true : ["error", "migration"],
            }),
        }),

        // ── Rate limiting ─────────────────────────────────────────────────────
        // Default: 100 requests / 60 s. Auth routes override this to 10 / 60 s.
        ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),

        // ── Feature modules ───────────────────────────────────────────────────
        AuthModule,
        UsersModule,
        SessionsModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        // Throttler guard applied globally; individual controllers can @Throttle() override.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        // JWT guard applied globally; routes opt out with @Public().
        { provide: APP_GUARD, useClass: JwtAuthGuard },
    ],
})
export class AppModule {}
