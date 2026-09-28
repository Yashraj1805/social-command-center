/** Platforms this system integrates with today (spec section 5). Adding one
 * later means widening this union + the DB CHECK constraints, nothing else. */
export const PLATFORMS = ["facebook", "instagram"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Message/comment intent taxonomy (spec section 13). */
export const INTENTS = [
  "PRICE",
  "OFFER",
  "SERVICE",
  "BOOKING",
  "TEST_DRIVE",
  "AVAILABILITY",
  "VEHICLE",
  "LOCATION",
  "FINANCE",
  "INSURANCE",
  "WARRANTY",
  "MAINTENANCE",
  "ACCESSORIES",
  "COMPLAINT",
  "FEEDBACK",
  "GENERAL_INFORMATION",
  "LEAD",
  "FOLLOW_UP",
  "SPAM",
  "OTHER",
] as const;
export type Intent = (typeof INTENTS)[number];

/** Intents that default to requiring human approval before sending (spec
 * section 16), unless a brand's settings explicitly opt an intent into
 * auto-reply (spec section 17). */
export const DEFAULT_HUMAN_APPROVAL_INTENTS: readonly Intent[] = [
  "PRICE",
  "COMPLAINT",
  "FINANCE",
  "INSURANCE",
  "WARRANTY",
  "BOOKING",
  "AVAILABILITY",
];

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const LEAD_INTENT_LEVELS = ["high", "medium", "low", "none"] as const;
export type LeadIntentLevel = (typeof LEAD_INTENT_LEVELS)[number];
