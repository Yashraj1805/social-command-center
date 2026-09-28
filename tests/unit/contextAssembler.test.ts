import { describe, expect, it } from "vitest";
import {
  assembleContext,
  resolveField,
  type TieredMetadata,
} from "../../src/rag/retrieval/contextAssembler.js";
import type { KnowledgeDocument } from "../../src/domain/entities/knowledge.js";

function doc(overrides: Partial<KnowledgeDocument>): KnowledgeDocument {
  return {
    id: "doc",
    organizationId: "org",
    brandId: "brand",
    locationId: null,
    campaignId: null,
    postId: null,
    knowledgeType: "OFFER",
    title: "title",
    content: "content",
    metadata: {},
    status: "active",
    createdByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("assembleContext", () => {
  it("always returns all five tiers in priority order, even when empty", () => {
    const result = assembleContext({
      postDocuments: [],
      campaignDocuments: [],
      conversation: null,
      brandDocuments: [],
      generalDocuments: [],
    });

    expect(result.tiers.map((t) => t.tier)).toEqual(["post", "campaign", "conversation", "brand", "general"]);
  });

  it("keeps each tier's documents separate rather than flattening them", () => {
    const postDoc = doc({ id: "post-doc" });
    const brandDoc = doc({ id: "brand-doc" });

    const result = assembleContext({
      postDocuments: [postDoc],
      campaignDocuments: [],
      conversation: null,
      brandDocuments: [brandDoc],
      generalDocuments: [],
    });

    const postTier = result.tiers.find((t) => t.tier === "post");
    const brandTier = result.tiers.find((t) => t.tier === "brand");

    expect(postTier?.documents).toEqual([postDoc]);
    expect(brandTier?.documents).toEqual([brandDoc]);
  });
});

describe("resolveField", () => {
  it("uses the post's field and never merges in an unrelated campaign's field (spec section 3 example)", () => {
    const sources: TieredMetadata[] = [
      { tier: "post", metadata: { offer: "Free 20-point inspection" } },
      { tier: "campaign", metadata: { offer: "10% discount on labor" } },
    ];

    const resolved = resolveField("offer", sources);

    expect(resolved?.value).toBe("Free 20-point inspection");
    expect(resolved?.sourceTier).toBe("post");
  });

  it("falls through to a lower tier only when the higher tier does not define the field", () => {
    const sources: TieredMetadata[] = [
      { tier: "post", metadata: {} },
      { tier: "campaign", metadata: { price: "₹1,299" } },
      { tier: "brand", metadata: { price: "should never be used" } },
    ];

    const resolved = resolveField("price", sources);

    expect(resolved?.value).toBe("₹1,299");
    expect(resolved?.sourceTier).toBe("campaign");
  });

  it("returns null when no tier defines the field", () => {
    const sources: TieredMetadata[] = [{ tier: "post", metadata: {} }];
    expect(resolveField("price", sources)).toBeNull();
  });
});
