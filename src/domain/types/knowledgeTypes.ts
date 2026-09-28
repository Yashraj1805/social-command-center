/** Knowledge document types (spec section 8). */
export const KNOWLEDGE_TYPES = [
  "BRAND",
  "DEALERSHIP",
  "VEHICLE",
  "SERVICE",
  "OFFER",
  "CAMPAIGN",
  "POST",
  "FAQ",
  "POLICY",
  "INSURANCE",
  "FINANCE",
  "LOCATION",
  "CONTACT",
  "CONVERSATION",
] as const;
export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];
