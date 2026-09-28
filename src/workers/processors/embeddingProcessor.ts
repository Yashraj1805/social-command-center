import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../../core/queue.js";
import { logger } from "../../core/logger.js";
import { knowledgeService } from "../../services/knowledge.service.js";
import type { EmbeddingJobData } from "../queues.js";

/** Consumes `embedding_queue`. This is the one queue with a real worker in
 * this phase -- it's the smallest end-to-end slice that proves the
 * enqueue -> process -> AI gateway -> DB write path works (route/service ->
 * BullMQ -> here -> aiGateway.embeddings -> knowledge_chunks). The other 8
 * queues declared in workers/queues.ts get workers the same way in the next
 * phase, once comment/message processing and publishing are wired up. */
export function startEmbeddingWorker(): Worker<EmbeddingJobData> {
  const worker = new Worker<EmbeddingJobData>(
    "embedding_queue",
    async (job: Job<EmbeddingJobData>) => {
      await knowledgeService.indexKnowledgeDocument(job.data.knowledgeDocumentId);
    },
    { connection: getRedisConnection(), concurrency: 4 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "embedding job failed");
  });

  return worker;
}
