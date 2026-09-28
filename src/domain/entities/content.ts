export const CONTENT_TYPES = [
  "blog",
  "instagram_caption",
  "facebook_caption",
  "short_caption",
  "long_caption",
  "carousel_copy",
  "reel_script",
  "story_copy",
  "cta",
  "hashtags",
  "seo_title",
  "meta_description",
  "faq",
  "campaign_copy",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export interface ContentGeneration {
  id: string;
  organizationId: string;
  brandId: string;
  contentType: ContentType;
  inputs: Record<string, unknown>;
  status: "draft" | "generated" | "fact_check_failed" | "approved" | "published";
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FactCheckResult {
  passed: boolean;
  flaggedClaims: Array<{ claim: string; reason: string }>;
}

/** variantLabel is free text but the content-generation service always
 * requests the five variants from spec section 20: Professional, Conversational,
 * High-engagement, Local/Hinglish, SEO-focused. */
export interface ContentVersion {
  id: string;
  contentGenerationId: string;
  variantLabel: string;
  content: Record<string, unknown>;
  isSelected: boolean;
  factCheckResult: FactCheckResult | null;
  createdAt: Date;
}

export type ScheduledPostStatus = "scheduled" | "publishing" | "published" | "failed" | "canceled";

export interface ScheduledPost {
  id: string;
  organizationId: string;
  brandId: string;
  socialAccountId: string;
  contentVersionId: string | null;
  postId: string | null;
  scheduledAt: Date;
  status: ScheduledPostStatus;
  publishedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
