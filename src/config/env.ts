import { z } from "zod";

// Every var the app can possibly need is declared here, even ones only used by
// providers that are still stubs (spec section 53: "keep Meta API version
// configurable", section 38: AI gateway). Empty strings are allowed for
// not-yet-configured secrets so the app can boot in a partially-configured
// dev environment; services that need a given key check for it themselves and
// fail with a clear error at the point of use, not at startup.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),

  META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  META_API_VERSION: z.string().default("v21.0"),
  META_OAUTH_REDIRECT_URI: z.string().default(""),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default(""),

  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_CHAT_MODEL: z.string().default("claude-sonnet-5"),
  VOYAGE_API_KEY: z.string().default(""),
  VOYAGE_EMBEDDING_MODEL: z.string().default("voyage-3"),

  JWT_SECRET: z.string().default("change_me_dev_only"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
