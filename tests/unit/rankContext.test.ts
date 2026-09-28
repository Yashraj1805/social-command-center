import { describe, expect, it } from "vitest";
import { rankContext, type KnowledgeCandidate } from "../../src/rag/ranking/rankContext.js";

function candidate(overrides: Partial<KnowledgeCandidate>): KnowledgeCandidate {
  return {
    knowledgeDocumentId: "doc",
    chunkId: "chunk",
    content: "content",
    knowledgeType: "FAQ",
    scope: { postId: null, campaignId: null, brandId: null },
    vectorSimilarity: 0,
    ...overrides,
  };
}

describe("rankContext", () => {
  it("ranks a post-specific match above a higher-similarity general match", () => {
    const postMatch = candidate({
      knowledgeDocumentId: "post-doc",
      scope: { postId: "post-1", campaignId: null, brandId: null },
      vectorSimilarity: 0.4,
    });
    const generalMatchWithHighSimilarity = candidate({
      knowledgeDocumentId: "general-doc",
      vectorSimilarity: 0.99,
    });

    const ranked = rankContext([generalMatchWithHighSimilarity, postMatch], {
      currentPostId: "post-1",
      currentCampaignId: null,
    });

    expect(ranked[0]?.knowledgeDocumentId).toBe("post-doc");
    expect(ranked[0]?.matchTier).toBe("post");
  });

  it("never lets a different post's offer outrank the current post's offer (spec TEST 3)", () => {
    const currentPostOffer = candidate({
      knowledgeDocumentId: "offer-x",
      scope: { postId: "post-A", campaignId: null, brandId: "brand-1" },
      vectorSimilarity: 0.5,
    });
    const otherPostOffer = candidate({
      knowledgeDocumentId: "offer-y",
      scope: { postId: "post-B", campaignId: null, brandId: "brand-1" },
      vectorSimilarity: 0.95,
    });

    const ranked = rankContext([otherPostOffer, currentPostOffer], {
      currentPostId: "post-A",
      currentCampaignId: null,
    });

    expect(ranked[0]?.knowledgeDocumentId).toBe("offer-x");
  });

  it("orders tiers post > campaign > vehicle > service > brand > general", () => {
    const general = candidate({ knowledgeDocumentId: "general" });
    const brand = candidate({ knowledgeDocumentId: "brand", scope: { postId: null, campaignId: null, brandId: "b1" } });
    const service = candidate({ knowledgeDocumentId: "service", knowledgeType: "SERVICE" });
    const vehicle = candidate({ knowledgeDocumentId: "vehicle", knowledgeType: "VEHICLE" });
    const campaign = candidate({
      knowledgeDocumentId: "campaign",
      scope: { postId: null, campaignId: "c1", brandId: "b1" },
    });
    const post = candidate({
      knowledgeDocumentId: "post",
      scope: { postId: "p1", campaignId: "c1", brandId: "b1" },
    });

    const ranked = rankContext([general, brand, service, vehicle, campaign, post], {
      currentPostId: "p1",
      currentCampaignId: "c1",
    });

    expect(ranked.map((r) => r.matchTier)).toEqual([
      "post",
      "campaign",
      "vehicle",
      "service",
      "brand",
      "general",
    ]);
  });
});
