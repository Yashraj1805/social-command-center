import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../core/logger.js";
import { AppError, ValidationError } from "../core/errors.js";
import "./types.js";
import { healthRoutes } from "./routes/health.route.js";
import { organizationRoutes } from "./routes/organizations.route.js";
import { brandRoutes } from "./routes/brands.route.js";
import { postRoutes } from "./routes/posts.route.js";
import { knowledgeRoutes } from "./routes/knowledge.route.js";
import { metaWebhookRoutes } from "./routes/webhooks.meta.route.js";

export function buildApp(): FastifyInstance {
  // Fastify builds its own pino instance from this config rather than reusing
  // core/logger.ts's `logger` directly -- Fastify's request logger and a
  // hand-constructed pino instance are typed slightly differently across
  // versions, and duplicating a few config fields here is simpler than
  // fighting that mismatch. `logger` (core/logger.ts) is still used for every
  // non-request log line in this file and the rest of the app.
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
          : undefined,
    },
  });

  // Captures the exact raw bytes of every JSON request body before parsing,
  // so webhooks.meta.route.ts can HMAC-verify against what Meta actually sent
  // (a re-serialized JS object is not guaranteed byte-identical).
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    request.rawBody = body as string;
    if ((body as string).length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(new ValidationError("Invalid JSON body"), undefined);
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({ error: "VALIDATION_ERROR", message: error.issues });
      return;
    }
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }
    logger.error({ err: error }, "unhandled error");
    reply.code(500).send({ error: "INTERNAL_ERROR", message: "Something went wrong" });
  });

  app.register(healthRoutes);
  app.register(organizationRoutes);
  app.register(brandRoutes);
  app.register(postRoutes);
  app.register(knowledgeRoutes);
  app.register(metaWebhookRoutes);

  return app;
}
