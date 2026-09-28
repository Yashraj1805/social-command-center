import { z } from "zod";
import { INTENTS, LEAD_INTENT_LEVELS, SENTIMENTS } from "../../domain/types/intents.js";

/** The exact structured JSON contract from spec section 15. Every customer-
 * reply AI run validates against this schema before the result is allowed to
 * reach a human reviewer or an auto-reply queue. */
export const customerReplySchema = z.object({
  intent: z.enum(INTENTS),
  sentiment: z.enum(SENTIMENTS),
  lead_intent: z.enum(LEAD_INTENT_LEVELS),
  requires_human: z.boolean(),
  reason_for_human: z.string().nullable(),
  reply: z.string(),
  source_context: z.enum(["post", "campaign", "brand", "unknown"]),
  confidence: z.number().min(0).max(1),
});

export type CustomerReplyOutput = z.infer<typeof customerReplySchema>;

export const CUSTOMER_REPLY_SCHEMA_DESCRIPTION = `{
  "intent": one of ${INTENTS.join(" | ")},
  "sentiment": one of ${SENTIMENTS.join(" | ")},
  "lead_intent": one of ${LEAD_INTENT_LEVELS.join(" | ")},
  "requires_human": boolean,
  "reason_for_human": string or null,
  "reply": string,
  "source_context": one of post | campaign | brand | unknown,
  "confidence": number between 0 and 1
}`;
