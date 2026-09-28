import { CONTEXT_PRIORITY, type ContextTier } from "../../domain/types/contextPriority.js";
import type { KnowledgeDocument } from "../../domain/entities/knowledge.js";

export interface ConversationMemory {
  summary: string | null;
  recentMessages: Array<{ sender: "customer" | "ai" | "human"; message: string }>;
}

export interface ContextTierBundle {
  tier: ContextTier;
  documents: KnowledgeDocument[];
}

export interface AssembledContext {
  /** Always all five tiers, in priority order, even when a tier is empty --
   * callers should never have to guess whether "post" was skipped or just had
   * no documents. */
  tiers: ContextTierBundle[];
  conversation: ConversationMemory | null;
}

/** Assembles the full context bundle for a customer message/comment, in the
 * exact priority order from spec section 3: post > campaign > conversation >
 * brand > general. This function does no DB I/O and does no merging -- each
 * tier's documents stay in their own bucket. Flattening/rendering into an LLM
 * prompt (and deciding what to do when two tiers disagree) is the AI gateway's
 * job in a later phase; this function's only contract is "never lose the
 * ordering, never blend tiers together." */
export function assembleContext(input: {
  postDocuments: KnowledgeDocument[];
  campaignDocuments: KnowledgeDocument[];
  conversation: ConversationMemory | null;
  brandDocuments: KnowledgeDocument[];
  generalDocuments: KnowledgeDocument[];
}): AssembledContext {
  const byTier: Record<Exclude<ContextTier, "conversation">, KnowledgeDocument[]> = {
    post: input.postDocuments,
    campaign: input.campaignDocuments,
    brand: input.brandDocuments,
    general: input.generalDocuments,
  };

  const tiers: ContextTierBundle[] = CONTEXT_PRIORITY.map((tier) => ({
    tier,
    documents: tier === "conversation" ? [] : byTier[tier],
  }));

  return { tiers, conversation: input.conversation };
}

export interface TieredMetadata {
  tier: ContextTier;
  metadata: Record<string, unknown>;
}

export interface ResolvedField {
  value: unknown;
  sourceTier: ContextTier;
}

/** Picks a single field's value from the highest-priority tier that defines
 * it, and stops -- it never merges the same field from two tiers. This is the
 * concrete mechanism behind spec section 3's example: if the current post
 * says "free inspection" and an unrelated campaign says "10% off labor," the
 * assembled answer uses only the post's fields, never both.
 *
 * `sources` must already be given in priority order (as `AssembledContext.tiers`
 * is); this function does not re-sort. */
export function resolveField(field: string, sources: readonly TieredMetadata[]): ResolvedField | null {
  for (const source of sources) {
    const value = source.metadata[field];
    if (value !== undefined && value !== null) {
      return { value, sourceTier: source.tier };
    }
  }
  return null;
}
