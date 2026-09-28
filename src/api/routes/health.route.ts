import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Deliberately does not touch the DB or Redis -- this endpoint's only job is
  // to prove the process is up, so it must stay green during a DB outage.
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
}
