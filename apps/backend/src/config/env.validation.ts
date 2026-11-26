import * as Joi from "joi";

export const envValidationSchema = Joi.object({
    NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
    PORT: Joi.number().default(3000),

    DATABASE_URL: Joi.string()
        .pattern(/^postgresql?:\/\//)
        .required()
        .messages({ "any.required": "DATABASE_URL is required" }),

    JWT_SECRET: Joi.string().min(32).required().messages({
        "any.required": "JWT_SECRET is required",
        "string.min": "JWT_SECRET must be at least 32 characters long",
    }),
    JWT_EXPIRES_IN: Joi.string().default("15m"),

    JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
        "any.required": "JWT_REFRESH_SECRET is required",
        "string.min": "JWT_REFRESH_SECRET must be at least 32 characters long",
    }),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),

    // ── AI worker ────────────────────────────────────────────────────────────
    AI_WORKER_URL: Joi.string().uri().default("http://localhost:8000"),
    AI_WORKER_TOKEN: Joi.string().allow("").default(""),
    ANALYSIS_CONCURRENCY: Joi.number().integer().min(1).max(16).default(2),
    ANALYSIS_POLL_INTERVAL_MS: Joi.number().integer().min(100).default(1000),
    /** Disable the in-process queue consumer (e.g. in tests). */
    ANALYSIS_PROCESSOR_ENABLED: Joi.boolean().default(true),

    // ── Users ────────────────────────────────────────────────────────────────
    /** Port of the admin panel, admin API and Swagger; publish it to the tailnet only. */
    ADMIN_PORT: Joi.number().port().default(3001),
    DEFAULT_MONTHLY_ANALYSIS_LIMIT: Joi.number().integer().min(0).default(100),
    /** Comma-separated e-mails that are promoted to admin on startup / registration. */
    ADMIN_EMAILS: Joi.string().allow("").default(""),

    // ── Push notifications (Expo) ────────────────────────────────────────────
    EXPO_PUSH_URL: Joi.string().uri().default("https://exp.host/--/api/v2/push/send"),
    EXPO_ACCESS_TOKEN: Joi.string().allow("").default(""),
});
