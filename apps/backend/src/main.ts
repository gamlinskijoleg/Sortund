import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { createServer } from "http";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { isPublicPath } from "./common/http/public-surface";

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const publicPort = Number(process.env.PORT ?? 3000);
    const adminPort = Number(process.env.ADMIN_PORT ?? 3001);

    // ── Two listeners, one app ───────────────────────────────────────────────
    // The public port is exposed to the internet (Tailscale Funnel) and serves only the routes the
    // mobile app needs. The admin API, the admin panel and Swagger answer only on the admin port,
    // which is published to the tailnet only (`tailscale serve`). The check is the first middleware,
    // so blocked requests never reach routing, static files or authentication.
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.socket.localPort === adminPort || isPublicPath(req.path)) return next();
        res.status(404).json({ statusCode: 404, message: "Not Found" });
    });

    // ── Security headers ──────────────────────────────────────────────────────
    app.use(helmet());

    // Trust the first proxy hop so req.ip resolves correctly behind nginx / Docker.
    app.getHttpAdapter().getInstance().set("trust proxy", 1);

    // ── CORS ──────────────────────────────────────────────────────────────────
    app.enableCors();

    // ── Validation ────────────────────────────────────────────────────────────
    app.useGlobalPipes(
        new ValidationPipe({
            // Strip unknown properties from incoming DTOs.
            whitelist: true,
            // Reject requests that contain properties not in the DTO.
            forbidNonWhitelisted: true,
            // Auto-transform plain objects to DTO class instances.
            transform: true,
        })
    );

    // ── Admin web panel (static files, talks to the same REST API) ───────────
    app.useStaticAssets(join(__dirname, "..", "..", "public", "admin"), { prefix: "/admin" });

    // ── Swagger ───────────────────────────────────────────────────────────────
    const swaggerConfig = new DocumentBuilder()
        .setTitle("Sortund API")
        .setDescription("REST API documentation")
        .setVersion("1.0")
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);

    await app.listen(publicPort);
    // Same Express instance (same routes, DB pool and queue) on the admin port.
    const adminServer = createServer(app.getHttpAdapter().getInstance());
    await new Promise<void>((resolve) => adminServer.listen(adminPort, resolve));
    app.enableShutdownHooks();
    process.once("SIGTERM", () => adminServer.close());

    console.log(`Public API (app):       http://localhost:${publicPort}`);
    console.log(`Admin panel:            http://localhost:${adminPort}/admin/`);
    console.log(`Swagger docs:           http://localhost:${adminPort}/api/docs`);
}

void bootstrap();
