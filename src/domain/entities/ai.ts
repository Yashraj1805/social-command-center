import type { Intent, LeadIntentLevel, Sentiment } from "../types/intents.js";

export type AiRunType = "customer_reply" | "intent_classification" | "content_generation" | "fact_check";

export interface AiRun {
  id: string;
  organizationId: string;
  brandId: string;
  runType: AiRunType;
  model: string;
  temperature: number;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  promptVersion: string;
  retrievedContext: Record<string, unknown>;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  validationResult: Record<string, unknown>;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: Date;
}

export type AiReplyStatus = "pending" | "approved" | "edited" | "rejected" | "sent";
export type AiReplySourceContext = "post" | "campaign" | "brand" | "unknown";

/** Matches the structured JSON contract in spec section 15 exactly. */
export interface AiReply {
  id: string;
  aiRunId: string;
  organizationId: string;
  brandId: string;
  targetType: "comment" | "conversation_message";
  targetId: string;
  intent: Intent | null;
  sentiment: Sentiment | null;
  leadIntent: LeadIntentLevel | null;
  requiresHuman: boolean;
  reasonForHuman: string | null;
  replyText: string;
  sourceContext: AiReplySourceContext;
  confidence: number;
  status: AiReplyStatus;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiFeedback {
  id: string;
  aiReplyId: string;
  userId: string | null;
  action: "approve" | "edit" | "reject" | "regenerate";
  editedText: string | null;
  notes: string | null;
  createdAt: Date;
}
