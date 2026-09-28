import { query } from "../core/db.js";
import { NotFoundError } from "../core/errors.js";
import { logger } from "../core/logger.js";
import { aiGateway } from "../ai/gateway/index.js";
import { chunkText } from "../rag/chunking/chunkText.js";
import {
  knowledgeDocumentRepository,
  type CreateKnowledgeDocumentInput,
} from "../repositories/knowledgeDocument.repository.js";
import { getQueue, type EmbeddingJobData } from "../workers/queues.js";
import type { KnowledgeDocument } from "../domain/entities/knowledge.js";

/** Formats a pgvector literal from a plain number array. node-postgres has no
 * built-in pgvector type support, so embeddings are passed as this string and
 * cast with `::vector` in the SQL -- the standard approach when not pulling in
 * the separate `pgvector` npm package. */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export const knowledgeService = {
  /** Creates a knowledge document and enqueues it for chunking + embedding
   * (spec section 33, step "Chunk relevant text" / "Generate embeddings").
   * The document is immediately usable for metadata-only retrieval; it only
   * becomes eligible for the semantic-similarity leg of hybrid retrieval once
   * indexKnowledgeDocument has run. */
  async createKnowledgeDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    const document = await knowledgeDocumentRepository.create(input);
    await getQueue("embedding_queue").add("index-document", {
      knowledgeDocumentId: document.id,
    } satisfies EmbeddingJobData);
    return document;
  },

  /** Chunks a knowledge document's content and stores embeddings for each
   * chunk. Idempotent: re-running (e.g. after the document was edited) clears
   * and re-inserts the chunks for that document rather than appending, so a
   * post edit never leaves a stale offer chunk searchable (spec section 34). */
  async indexKnowledgeDocument(knowledgeDocumentId: string): Promise<void> {
    const result = await query<{ id: string; content: string }>(
      `SELECT id, content FROM knowledge_documents WHERE id = $1`,
      [knowledgeDocumentId],
    );
    const document = result.rows[0];
    if (!document) throw new NotFoundError("KnowledgeDocument", knowledgeDocumentId);

    const chunks = chunkText(document.content);
    if (chunks.length === 0) {
      logger.warn({ knowledgeDocumentId }, "knowledge document has no content to index");
      return;
    }

    const { embeddings } = await aiGateway.embeddings({ input: chunks.map((c) => c.content) });

    await query(`DELETE FROM knowledge_chunks WHERE knowledge_document_id = $1`, [knowledgeDocumentId]);

    for (const [i, chunk] of chunks.entries()) {
      const embedding = embeddings[i];
      if (!embedding) {
        throw new Error(
          `Embeddings provider returned ${embeddings.length} vectors for ${chunks.length} chunks`,
        );
      }
      await query(
        `INSERT INTO knowledge_chunks (knowledge_document_id, chunk_index, content, token_count, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [knowledgeDocumentId, chunk.index, chunk.content, chunk.approxTokenCount, toVectorLiteral(embedding)],
      );
    }

    logger.info({ knowledgeDocumentId, chunkCount: chunks.length }, "indexed knowledge document");
  },

  async disableKnowledgeDocument(organizationId: string, id: string): Promise<void> {
    await knowledgeDocumentRepository.disable(organizationId, id);
  },
};
