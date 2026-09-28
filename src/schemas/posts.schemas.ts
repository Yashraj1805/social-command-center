import { z } from "zod";
import { PLATFORMS } from "../domain/types/intents.js";

const postVersionMetadataSchema = z.object({
  vehicle: z.string().optional(),
  model: z.string().optional(),
  variant: z.string().optional(),
  price: z.string().optional(),
  discount: z.string().optional(),
  service: z.string().optional(),
  dates: z.string().optional(),
  location: z.string().optional(),
  eligibility: z.string().optional(),
  terms: z.string().optional(),
  cta: z.string().optional(),
  contact: z.string().optional(),
  customFaq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  additionalInstructions: z.string().optional(),
});

export const createPostSchema = z.object({
  brandId: z.string().uuid(),
  socialAccountId: z.string().uuid(),
  campaignId: z.string().uuid().nullable().optional(),
  platform: z.enum(PLATFORMS),
  caption: z.string().min(1),
  media: z.array(z.object({ type: z.enum(["image", "video"]), url: z.string().url() })).optional(),
  metadata: postVersionMetadataSchema.optional(),
});

export const updatePostContentSchema = z.object({
  caption: z.string().min(1),
  media: z.array(z.object({ type: z.enum(["image", "video"]), url: z.string().url() })).optional(),
  metadata: postVersionMetadataSchema.optional(),
});
