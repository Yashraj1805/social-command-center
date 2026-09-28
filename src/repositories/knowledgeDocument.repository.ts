import { query } from "../core/db.js";
import type { KnowledgeType } from "../domain/types/knowledgeTypes.js";
import type { KnowledgeDocument } from "../domain/entities/knowledge.js";
import { TenantScopedRepository, mapRows, requireRow } from "./base.repository.js";

export interface CreateKnowledgeDocumentInput {
  organizationId: string;
  brandId?: string | null;
  locationId?: string | null;
  campaignId?: string | null;
  postId?: string | null;
  knowledgeType: KnowledgeType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdByUserId?: string | null;
}

class KnowledgeDocumentRepository extends TenantScopedRepository<KnowledgeDocument> {
  protected table = "knowledge_documents";
  protected entityName = "KnowledgeDocument";

  async create(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    const result = await query(
      `INSERT INTO knowledge_documents
         (organization_id, brand_id, location_id, campaign_id, post_id, knowledge_type, title, content, metadata, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.organizationId,
        input.brandId ?? null,
        input.locationId ?? null,
        input.campaignId ?? null,
        input.postId ?? null,
        input.knowledgeType,
        input.title,
        input.content,
        JSON.stringify(input.metadata ?? {}),
        input.createdByUserId ?? null,
      ],
    );
    return requireRow<KnowledgeDocument>(result.rows);
  }

  async findById(organizationId: string, id: string): Promise<KnowledgeDocument | null> {
    return this.findByIdScoped(organizationId, id);
  }

  /** Tier 1 (spec section 3): knowledge explicitly attached to this post. */
  async findByPost(organizationId: string, postId: string): Promise<KnowledgeDocument[]> {
    const result = await query(
      `SELECT * FROM knowledge_documents
       WHERE organization_id = $1 AND post_id = $2 AND status = 'active'
       ORDER BY updated_at DESC`,
      [organizationId, postId],
    );
    return mapRows<KnowledgeDocument>(result.rows);
  }

  /** Tier 2: knowledge attached to the post's campaign (not scoped to any
   * specific post within it). */
  async findByCampaign(organizationId: string, campaignId: string): Promise<KnowledgeDocument[]> {
    const result = await query(
      `SELECT * FROM knowledge_documents
       WHERE organization_id = $1 AND campaign_id = $2 AND post_id IS NULL AND status = 'active'
       ORDER BY updated_at DESC`,
      [organizationId, campaignId],
    );
    return mapRows<KnowledgeDocument>(result.rows);
  }

  /** Tier 4: brand/dealership-level knowledge not tied to any specific
   * campaign or post. */
  async findByBrand(organizationId: string, brandId: string): Promise<KnowledgeDocument[]> {
    const result = await query(
      `SELECT * FROM knowledge_documents
       WHERE organization_id = $1 AND brand_id = $2
         AND campaign_id IS NULL AND post_id IS NULL AND status = 'active'
       ORDER BY updated_at DESC`,
      [organizationId, brandId],
    );
    return mapRows<KnowledgeDocument>(result.rows);
  }

  /** Tier 5: organization-level general automotive knowledge, not scoped to
   * any brand. */
  async findGeneral(organizationId: string): Promise<KnowledgeDocument[]> {
    const result = await query(
      `SELECT * FROM knowledge_documents
       WHERE organization_id = $1 AND brand_id IS NULL AND status = 'active'
       ORDER BY updated_at DESC`,
      [organizationId],
    );
    return mapRows<KnowledgeDocument>(result.rows);
  }

  async disable(organizationId: string, id: string): Promise<void> {
    await query(
      `UPDATE knowledge_documents SET status = 'disabled' WHERE organization_id = $1 AND id = $2`,
      [organizationId, id],
    );
  }
}

export const knowledgeDocumentRepository = new KnowledgeDocumentRepository();
