import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

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

    // ── Swagger ───────────────────────────────────────────────────────────────
    const swaggerConfig = new DocumentBuilder()
        .setTitle("Sortund API")
        .setDescription("REST API documentation")
        .setVersion("1.0")
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);

    await app.listen(process.env.PORT ?? 3000);
    console.log(`Application running on: ${await app.getUrl()}`);
    console.log(`Swagger docs:           ${await app.getUrl()}/api/docs`);
}

void bootstrap();
