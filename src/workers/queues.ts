import { Queue } from "bullmq";
import { getRedisConnection } from "../core/queue.js";

/** The 9 queues from spec section 32. Every queue is defined here so job
 * producers (API routes) and consumers (this folder's processors) always
 * agree on the name. Only `embedding_queue` has a real worker wired up in
 * this phase (see processors/embeddingProcessor.ts); the rest are declared
 * now so routes can enqueue into them without a later rename, and get workers
 * in the next phase. */
export const QUEUE_NAMES = [
  "social_webhook_queue",
  "comment_processing_queue",
  "message_processing_queue",
  "ai_generation_queue",
  "content_generation_queue",
  "publishing_queue",
  "analytics_queue",
  "embedding_queue",
  "notification_queue",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: getRedisConnection() });
    queues.set(name, queue);
  }
  return queue;
}

export interface EmbeddingJobData {
  knowledgeDocumentId: string;
}

export interface SocialWebhookJobData {
  webhookEventId: string;
}
