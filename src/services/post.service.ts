import { query } from "../core/db.js";
import type { Platform } from "../domain/types/intents.js";
import type { Post, PostVersion, PostVersionMetadata } from "../domain/entities/post.js";
import { postRepository } from "../repositories/post.repository.js";
import { knowledgeService } from "./knowledge.service.js";
import { getQueue, type EmbeddingJobData } from "../workers/queues.js";

function renderMetadataForKnowledge(metadata: PostVersionMetadata): string {
  const lines = Object.entries(metadata)
    .filter(([key, value]) => key !== "customFaq" && value)
    .map(([key, value]) => `${key}: ${value}`);
  if (metadata.customFaq?.length) {
    for (const faq of metadata.customFaq) {
      lines.push(`Q: ${faq.question}\nA: ${faq.answer}`);
    }
  }
  return lines.join("\n");
}

export const postService = {
  /** Post ingestion (spec section 33): create the post + its first version,
   * then derive a POST-scoped knowledge document from the caption and
   * structured metadata so the post is immediately available to retrieval
   * (post_knowledge_links + indexing happen here, not left as a manual step). */
  async createPost(input: {
    organizationId: string;
    brandId: string;
    socialAccountId: string;
    campaignId?: string | null;
    platform: Platform;
    caption: string;
    media?: Array<{ type: "image" | "video"; url: string }>;
    metadata?: PostVersionMetadata;
    createdByUserId?: string | null;
  }): Promise<{ post: Post; version: PostVersion }> {
    const { post, version } = await postRepository.createWithFirstVersion(input);

    const knowledgeContent = [input.caption, renderMetadataForKnowledge(input.metadata ?? {})]
      .filter(Boolean)
      .join("\n\n");

    if (knowledgeContent.trim().length > 0) {
      const knowledgeDocument = await knowledgeService.createKnowledgeDocument({
        organizationId: input.organizationId,
        brandId: input.brandId,
        campaignId: input.campaignId ?? null,
        postId: post.id,
        knowledgeType: "POST",
        title: input.caption.slice(0, 120) || `Post ${post.id}`,
        content: knowledgeContent,
        // knowledge_documents.metadata is a generic jsonb bag; PostVersionMetadata
        // is a narrower, purpose-built shape for post authoring, hence the cast.
        metadata: (input.metadata ?? {}) as Record<string, unknown>,
        createdByUserId: input.createdByUserId ?? null,
      });

      await query(
        `INSERT INTO post_knowledge_links (post_id, knowledge_document_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [post.id, knowledgeDocument.id],
      );
    }

    return { post, version };
  },

  /** New version = new offer/vehicle/CTA fields. Re-derives the linked POST
   * knowledge document from the new version so stale offer data never stays
   * searchable after an edit (spec section 34). */
  async updatePostContent(input: {
    organizationId: string;
    postId: string;
    caption: string;
    media?: Array<{ type: "image" | "video"; url: string }>;
    metadata?: PostVersionMetadata;
    createdByUserId?: string | null;
  }): Promise<PostVersion> {
    const version = await postRepository.addVersion(input);

    const existingLink = await query<{ knowledge_document_id: string }>(
      `SELECT knowledge_document_id FROM post_knowledge_links WHERE post_id = $1 LIMIT 1`,
      [input.postId],
    );
    const knowledgeDocumentId = existingLink.rows[0]?.knowledge_document_id;
    if (knowledgeDocumentId) {
      const knowledgeContent = [input.caption, renderMetadataForKnowledge(input.metadata ?? {})]
        .filter(Boolean)
        .join("\n\n");
      await query(
        `UPDATE knowledge_documents SET content = $1, metadata = $2, title = $3 WHERE id = $4`,
        [knowledgeContent, JSON.stringify(input.metadata ?? {}), input.caption.slice(0, 120), knowledgeDocumentId],
      );
      // Re-embedding runs on the worker, not inline, so an editor saving a post
      // never blocks on an embeddings API call (same "don't block on AI work"
      // rule as the webhook path -- spec section 32).
      await getQueue("embedding_queue").add("index-document", {
        knowledgeDocumentId,
      } satisfies EmbeddingJobData);
    }

    return version;
  },

  async getPost(organizationId: string, postId: string): Promise<Post> {
    return postRepository.requireById(organizationId, postId);
  },

  async listPosts(organizationId: string, brandId: string): Promise<Post[]> {
    return postRepository.listByBrand(organizationId, brandId);
  },
};
