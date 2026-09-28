import { query } from "../core/db.js";
import type { Platform } from "../domain/types/intents.js";
import type { SocialAccount, SocialAccountToken } from "../domain/entities/socialAccount.js";
import { TenantScopedRepository, mapRows, optionalRow, requireRow } from "./base.repository.js";

class SocialAccountRepository extends TenantScopedRepository<SocialAccount> {
  protected table = "social_accounts";
  protected entityName = "SocialAccount";

  async create(input: {
    organizationId: string;
    brandId: string;
    locationId?: string | null;
    platform: Platform;
    externalAccountId: string;
    name: string;
    username?: string | null;
    connectedByUserId?: string | null;
  }): Promise<SocialAccount> {
    const result = await query(
      `INSERT INTO social_accounts
         (organization_id, brand_id, location_id, platform, external_account_id, name, username, connected_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.organizationId,
        input.brandId,
        input.locationId ?? null,
        input.platform,
        input.externalAccountId,
        input.name,
        input.username ?? null,
        input.connectedByUserId ?? null,
      ],
    );
    return requireRow<SocialAccount>(result.rows);
  }

  async findById(organizationId: string, id: string): Promise<SocialAccount | null> {
    return this.findByIdScoped(organizationId, id);
  }

  async listByBrand(organizationId: string, brandId: string): Promise<SocialAccount[]> {
    const result = await query(
      `SELECT * FROM social_accounts WHERE organization_id = $1 AND brand_id = $2 ORDER BY name`,
      [organizationId, brandId],
    );
    return mapRows<SocialAccount>(result.rows);
  }

  /** Stores an access/refresh token for an account. `accessTokenEncrypted` must
   * already be encrypted by the caller (see core/crypto.ts's encryptSecret) --
   * this repository never sees plaintext tokens. */
  async storeToken(input: {
    socialAccountId: string;
    accessTokenEncrypted: string;
    tokenType?: string;
    scopes?: string[];
    expiresAt?: Date | null;
  }): Promise<SocialAccountToken> {
    const result = await query(
      `INSERT INTO social_account_tokens
         (social_account_id, access_token_encrypted, token_type, scopes, expires_at, refreshed_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [
        input.socialAccountId,
        input.accessTokenEncrypted,
        input.tokenType ?? "bearer",
        input.scopes ?? [],
        input.expiresAt ?? null,
      ],
    );
    return requireRow<SocialAccountToken>(result.rows);
  }

  async getLatestToken(socialAccountId: string): Promise<SocialAccountToken | null> {
    const result = await query(
      `SELECT * FROM social_account_tokens
       WHERE social_account_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [socialAccountId],
    );
    return optionalRow<SocialAccountToken>(result.rows);
  }
}

export const socialAccountRepository = new SocialAccountRepository();
