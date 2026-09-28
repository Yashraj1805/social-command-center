import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { query } from "../../core/db.js";
import { logger } from "../../core/logger.js";
import { metaProvider } from "../../providers/social/MetaProvider.js";
import { getQueue, type SocialWebhookJobData } from "../../workers/queues.js";

interface MetaWebhookPayload {
  object?: string;
  entry?: unknown[];
}

/** POST /webhooks/meta and its GET verification handshake (spec sections 6,
 * 30, 54). The handler's only synchronous work is: verify signature, persist
 * the raw event, ack, enqueue -- it never waits on AI/RAG processing, per
 * "never block webhook responses while waiting for an LLM." Actually
 * classifying/routing the event (identify brand -> post -> customer ->
 * retrieve context -> AI engine) happens in the comment/message processors,
 * which is the next phase; this route's job stops at "durably queued." */
export async function metaWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.get("/webhooks/meta", async (request, reply) => {
    const query_ = request.query as Record<string, string | undefined>;
    const challenge = metaProvider.verifyWebhookChallenge(
      query_["hub.mode"],
      query_["hub.verify_token"],
      query_["hub.challenge"],
    );
    if (challenge === null) {
      reply.code(403);
      return { error: "verification failed" };
    }
    reply.type("text/plain");
    return challenge;
  });

  app.post("/webhooks/meta", async (request, reply) => {
    const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
    const signatureHeader = request.headers["x-hub-signature-256"] as string | undefined;
    const signatureValid = metaProvider.verifyWebhookSignature(rawBody, signatureHeader);

    if (!signatureValid) {
      logger.warn("rejected webhook delivery with invalid signature");
      reply.code(401);
      return { error: "invalid signature" };
    }

    // Fast ack immediately after signature verification -- everything below
    // this point is a single indexed INSERT plus a queue push, no LLM call.
    reply.code(200);

    const payload = (request.body ?? {}) as MetaWebhookPayload;
    const platform: "facebook" | "instagram" = payload.object === "instagram" ? "instagram" : "facebook";

    // Meta does not send one canonical delivery id; hashing the raw body gives
    // idempotency for exact-duplicate redeliveries (spec section 31/54). Truly
    // granular per-comment/per-message idempotency is enforced downstream by
    // this schema's own UNIQUE constraints (comments.external_comment_id, etc.)
    // once a processor extracts individual entries from `payload`.
    const externalEventId = createHash("sha256").update(rawBody).digest("hex");

    const existing = await query<{ id: string; status: string }>(
      `SELECT id, status FROM webhook_events WHERE platform = $1 AND external_event_id = $2`,
      [platform, externalEventId],
    );

    if (existing.rows.length > 0) {
      logger.info({ externalEventId }, "duplicate webhook delivery, ack without reprocessing");
      return { status: "duplicate" };
    }

    const inserted = await query<{ id: string }>(
      `INSERT INTO webhook_events (platform, event_type, external_event_id, payload, signature_valid, status)
       VALUES ($1, $2, $3, $4, $5, 'received')
       RETURNING id`,
      [platform, payload.object ?? "unknown", externalEventId, JSON.stringify(payload), signatureValid],
    );
    const webhookEventId = inserted.rows[0]!.id;

    await getQueue("social_webhook_queue").add("process-webhook-event", {
      webhookEventId,
    } satisfies SocialWebhookJobData);

    return { status: "queued" };
  });
}
