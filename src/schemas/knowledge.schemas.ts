import { z } from "zod";
import { KNOWLEDGE_TYPES } from "../domain/types/knowledgeTypes.js";

export const createKnowledgeDocumentSchema = z.object({
  brandId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  postId: z.string().uuid().nullable().optional(),
  knowledgeType: z.enum(KNOWLEDGE_TYPES),
  title: z.string().min(1),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
