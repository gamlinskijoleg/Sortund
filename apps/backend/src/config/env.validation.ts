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
});
