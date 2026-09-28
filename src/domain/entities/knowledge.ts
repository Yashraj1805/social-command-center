import type { KnowledgeType } from "../types/knowledgeTypes.js";

/** A knowledge document's scope is defined entirely by which of these
 * optional FKs are set. brandId + everything below it null = general
 * automotive knowledge (spec section 3, tier 5). See rag/retrieval/contextAssembler.ts
 * for how scope maps to retrieval priority. */
export interface KnowledgeDocument {
  id: string;
  organizationId: string;
  brandId: string | null;
  locationId: string | null;
  campaignId: string | null;
  postId: string | null;
  knowledgeType: KnowledgeType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  status: "active" | "disabled" | "pending_approval";
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeChunk {
  id: string;
  knowledgeDocumentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  /** null until the embedding worker processes this chunk. */
  embedding: number[] | null;
  createdAt: Date;
}
