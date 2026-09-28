import { buildApp } from "./api/app.js";
import { env } from "./config/env.js";
import { logger } from "./core/logger.js";
import { startEmbeddingWorker } from "./workers/processors/embeddingProcessor.js";

async function main() {
  const app = buildApp();

  // The embedding worker needs Redis; in a dev environment without
  // docker-compose up yet, the API should still boot (GET /health stays
  // green) -- only DB/Redis-touching routes and this worker fail.
  try {
    startEmbeddingWorker();
    logger.info("embedding worker started");
  } catch (err) {
    logger.warn({ err }, "embedding worker not started (Redis not configured?)");
  }

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`social-command-center listening on :${env.PORT}`);
}

main().catch((err) => {
  logger.error({ err }, "fatal startup error");
  process.exit(1);
});
