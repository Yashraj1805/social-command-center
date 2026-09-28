import type { KnowledgeType } from "../../domain/types/knowledgeTypes.js";

export type MatchTier = "post" | "campaign" | "vehicle" | "service" | "brand" | "general";

/** Spec section 11's literal priority order. Note this mixes scope-based tiers
 * (post/campaign/brand/general) with knowledge-*type*-based tiers
 * (vehicle/service) -- that's intentional per the spec, not a simplification:
 * a VEHICLE-type doc should outrank a same-scope non-vehicle doc once we're
 * past the post/campaign scope check. */
const MATCH_TIER_ORDER: readonly MatchTier[] = [
  "post",
  "campaign",
  "vehicle",
  "service",
  "brand",
  "general",
];

export interface KnowledgeCandidate {
  knowledgeDocumentId: string;
  chunkId: string;
  content: string;
  knowledgeType: KnowledgeType;
  scope: {
    postId: string | null;
    campaignId: string | null;
    brandId: string | null;
  };
  /** Cosine similarity from the pgvector query, 0-1. Supplied by the caller --
   * this module has no DB access, it only ranks candidates it's handed. */
  vectorSimilarity: number;
  keywordMatchScore?: number;
  /** Days since the source document was last updated; used only as a small
   * tie-breaker, never to override a metadata match (spec section 11: "Do not
   * blindly trust vector similarity. Metadata correctness is more important
   * than semantic similarity."). */
  recencyDays?: number;
}

export interface RankedKnowledgeCandidate extends KnowledgeCandidate {
  matchTier: MatchTier;
  score: number;
}

const TIER_WEIGHT = 1000;
const VECTOR_WEIGHT = 10;
const KEYWORD_WEIGHT = 5;
const RECENCY_HALF_LIFE_DAYS = 90;

function resolveMatchTier(
  candidate: KnowledgeCandidate,
  currentPostId: string | null,
  currentCampaignId: string | null,
): MatchTier {
  if (currentPostId && candidate.scope.postId === currentPostId) return "post";
  if (currentCampaignId && candidate.scope.campaignId === currentCampaignId) return "campaign";
  if (candidate.knowledgeType === "VEHICLE") return "vehicle";
  if (candidate.knowledgeType === "SERVICE") return "service";
  if (candidate.scope.brandId) return "brand";
  return "general";
}

/** Hybrid ranking (spec section 11): metadata tier dominates the score by a
 * wide margin, so a correct-but-less-semantically-similar match always beats
 * an irrelevant-scope high-similarity match. Vector similarity and keyword
 * match only break ties *within* a tier. Pure function, no I/O. */
export function rankContext(
  candidates: readonly KnowledgeCandidate[],
  params: { currentPostId: string | null; currentCampaignId: string | null },
): RankedKnowledgeCandidate[] {
  const ranked = candidates.map((candidate) => {
    const matchTier = resolveMatchTier(candidate, params.currentPostId, params.currentCampaignId);
    const tierIndex = MATCH_TIER_ORDER.indexOf(matchTier);
    const tierScore = (MATCH_TIER_ORDER.length - tierIndex) * TIER_WEIGHT;

    const recencyDecay = candidate.recencyDays
      ? Math.exp(-candidate.recencyDays / RECENCY_HALF_LIFE_DAYS)
      : 1;

    const score =
      tierScore +
      candidate.vectorSimilarity * VECTOR_WEIGHT +
      (candidate.keywordMatchScore ?? 0) * KEYWORD_WEIGHT +
      recencyDecay;

    return { ...candidate, matchTier, score };
  });

  return ranked.sort((a, b) => b.score - a.score);
}
