import type { Platform } from "../types/intents.js";

export type PostStatus = "draft" | "scheduled" | "published" | "failed" | "needs_review";
export type CampaignStatus = "draft" | "active" | "paused" | "ended";

export interface Campaign {
  id: string;
  organizationId: string;
  brandId: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: CampaignStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  organizationId: string;
  brandId: string;
  socialAccountId: string;
  campaignId: string | null;
  platform: Platform;
  externalPostId: string | null;
  status: PostStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  activeVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Structured offer/vehicle/CTA fields attached to a post (spec section 9). All
 * optional: a post can carry as much or as little structured knowledge as the
 * creator supplies -- the AI must never infer missing fields. */
export interface PostVersionMetadata {
  vehicle?: string;
  model?: string;
  variant?: string;
  price?: string;
  discount?: string;
  service?: string;
  campaignId?: string;
  dates?: string;
  location?: string;
  eligibility?: string;
  terms?: string;
  cta?: string;
  contact?: string;
  customFaq?: Array<{ question: string; answer: string }>;
  additionalInstructions?: string;
}

export interface PostVersion {
  id: string;
  postId: string;
  versionNumber: number;
  caption: string;
  media: Array<{ type: "image" | "video"; url: string }>;
  metadata: PostVersionMetadata;
  createdByUserId: string | null;
  createdAt: Date;
}
