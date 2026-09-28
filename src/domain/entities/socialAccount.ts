import type { Platform } from "../types/intents.js";

export type SocialAccountStatus = "connected" | "disconnected" | "error" | "pending_permissions";

export interface SocialAccount {
  id: string;
  organizationId: string;
  brandId: string;
  locationId: string | null;
  platform: Platform;
  externalAccountId: string;
  name: string;
  username: string | null;
  status: SocialAccountStatus;
  connectedByUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Never returned by any API response or logged in full -- access_token_encrypted
 * is application-layer-encrypted at rest and decrypted only inside a provider
 * call (spec section 30: "Never expose Meta access tokens to frontend"). */
export interface SocialAccountToken {
  id: string;
  socialAccountId: string;
  accessTokenEncrypted: string;
  tokenType: string;
  scopes: string[];
  expiresAt: Date | null;
  refreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
