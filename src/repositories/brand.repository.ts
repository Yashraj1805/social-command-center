import { query } from "../core/db.js";
import type { Brand, BrandVoiceConfig } from "../domain/entities/brand.js";
import { TenantScopedRepository, mapRows, requireRow } from "./base.repository.js";

class BrandRepository extends TenantScopedRepository<Brand> {
  protected table = "brands";
  protected entityName = "Brand";

  async create(input: {
    organizationId: string;
    name: string;
    slug: string;
    voiceConfig?: BrandVoiceConfig;
  }): Promise<Brand> {
    const result = await query(
      `INSERT INTO brands (organization_id, name, slug, voice_config)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.organizationId, input.name, input.slug, JSON.stringify(input.voiceConfig ?? {})],
    );
    return requireRow<Brand>(result.rows);
  }

  /** Tenant-scoped lookup -- callers always pass the requesting organization's
   * id, so a brand belonging to another organization can never be returned
   * (spec section 4). */
  async findById(organizationId: string, id: string): Promise<Brand | null> {
    return this.findByIdScoped(organizationId, id);
  }

  async requireById(organizationId: string, id: string): Promise<Brand> {
    return this.requireByIdScoped(organizationId, id);
  }

  async listByOrganization(organizationId: string): Promise<Brand[]> {
    const result = await query(
      `SELECT * FROM brands WHERE organization_id = $1 ORDER BY name`,
      [organizationId],
    );
    return mapRows<Brand>(result.rows);
  }
}

export const brandRepository = new BrandRepository();
