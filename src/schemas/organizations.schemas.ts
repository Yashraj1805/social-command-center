import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1),
});

export const createBrandSchema = z.object({
  name: z.string().min(1),
  voiceConfig: z
    .object({
      tone: z.string().optional(),
      vocabulary: z.array(z.string()).optional(),
      languagePreference: z.array(z.string()).optional(),
      emojiUsage: z.enum(["none", "light", "moderate"]).optional(),
      ctaStyle: z.string().optional(),
      greetingStyle: z.string().optional(),
      forbiddenPhrases: z.array(z.string()).optional(),
      preferredPhrases: z.array(z.string()).optional(),
      customerHandlingNotes: z.string().optional(),
    })
    .optional(),
});
