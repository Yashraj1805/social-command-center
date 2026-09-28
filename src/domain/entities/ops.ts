import type { Platform } from "../types/intents.js";

export type WebhookEventStatus = "received" | "processing" | "processed" | "failed" | "duplicate";

export interface WebhookEvent {
  id: string;
  organizationId: string | null;
  platform: Platform;
  eventType: string;
  externalEventId: string;
  payload: Record<string, unknown>;
  signatureValid: boolean;
  status: WebhookEventStatus;
  receivedAt: Date;
  processedAt: Date | null;
  error: string | null;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

/** Auto-reply / approval policy config (spec section 17), stored as the value
 * of a settings row keyed "ai_policy". brandId null on the Setting row = org default. */
export interface AiPolicySettingValue {
  autoReplyEnabled: boolean;
  autoReplyIntents: string[];
  humanApprovalIntents: string[];
  minConfidence: number;
  businessHours?: { timezone: string; windows: Array<{ day: number; start: string; end: string }> };
}

export interface Setting {
  id: string;
  organizationId: string;
  brandId: string | null;
  key: string;
  value: unknown;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
