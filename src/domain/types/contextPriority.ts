/** The context hierarchy from spec section 3. Index in this array *is* the
 * priority: lower index wins, and tiers are never merged when they conflict.
 * `rag/retrieval/contextAssembler.ts` and `rag/ranking/rankContext.ts` both
 * key off this list so the ordering only has to be correct in one place. */
export const CONTEXT_PRIORITY = [
  "post",
  "campaign",
  "conversation",
  "brand",
  "general",
] as const;

export type ContextTier = (typeof CONTEXT_PRIORITY)[number];

export function tierRank(tier: ContextTier): number {
  return CONTEXT_PRIORITY.indexOf(tier);
}
