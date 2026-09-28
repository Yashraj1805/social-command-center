import type { Intent, LeadIntentLevel, Platform, Sentiment } from "../types/intents.js";

export type CommentStatus = "new" | "processing" | "awaiting_approval" | "replied" | "ignored" | "spam";

export interface Customer {
  id: string;
  organizationId: string;
  brandId: string;
  platform: Platform;
  externalCustomerId: string;
  name: string | null;
  profileUrl: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  organizationId: string;
  brandId: string;
  postId: string;
  customerId: string | null;
  platform: Platform;
  externalCommentId: string;
  parentExternalCommentId: string | null;
  authorName: string | null;
  message: string;
  intent: Intent | null;
  sentiment: Sentiment | null;
  leadIntent: LeadIntentLevel | null;
  requiresHuman: boolean;
  status: CommentStatus;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentReply {
  id: string;
  commentId: string;
  aiReplyId: string | null;
  repliedByUserId: string | null;
  message: string;
  status: "pending" | "sent" | "failed";
  externalReplyId: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationStatus = "open" | "awaiting_approval" | "resolved" | "escalated";

export interface Conversation {
  id: string;
  organizationId: string;
  brandId: string;
  socialAccountId: string;
  customerId: string;
  postId: string | null;
  campaignId: string | null;
  platform: Platform;
  externalThreadId: string;
  status: ConversationStatus;
  /** Rolling summary used in prompts instead of full history (spec section 35/36). */
  summary: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  sender: "customer" | "ai" | "human";
  message: string;
  externalMessageId: string | null;
  aiReplyId: string | null;
  status: "received" | "pending_approval" | "sent" | "failed";
  sentAt: Date | null;
  createdAt: Date;
}

export interface Lead {
  id: string;
  organizationId: string;
  brandId: string;
  customerId: string;
  conversationId: string | null;
  commentId: string | null;
  postId: string | null;
  campaignId: string | null;
  sourcePlatform: Platform;
  intent: Intent | null;
  leadIntent: Exclude<LeadIntentLevel, "none">;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  createdAt: Date;
  updatedAt: Date;
}
