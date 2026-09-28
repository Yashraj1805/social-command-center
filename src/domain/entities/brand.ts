/** Brand voice configuration (spec section 26). Every field is optional so a
 * brand can start with nothing configured and the AI gateway falls back to
 * neutral, professional defaults. */
export interface BrandVoiceConfig {
  tone?: string;
  vocabulary?: string[];
  languagePreference?: string[];
  emojiUsage?: "none" | "light" | "moderate";
  ctaStyle?: string;
  greetingStyle?: string;
  forbiddenPhrases?: string[];
  preferredPhrases?: string[];
  customerHandlingNotes?: string;
}

export interface Brand {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  voiceConfig: BrandVoiceConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  organizationId: string;
  brandId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}
