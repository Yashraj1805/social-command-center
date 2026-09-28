import type { Brand, BrandVoiceConfig } from "../domain/entities/brand.js";
import type { Organization } from "../domain/entities/organization.js";
import { brandRepository } from "../repositories/brand.repository.js";
import { organizationRepository } from "../repositories/organization.repository.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const organizationService = {
  async createOrganization(name: string): Promise<Organization> {
    return organizationRepository.create({ name, slug: slugify(name) });
  },

  /** Onboards a new brand under an organization (spec section 4 example:
   * Galaxy Toyota / Hans Hyundai / Auto Car Repair are each a Brand under one
   * Organization). Adding a fourth dealership later is just another call to
   * this, no schema change. */
  async createBrand(input: {
    organizationId: string;
    name: string;
    voiceConfig?: BrandVoiceConfig;
  }): Promise<Brand> {
    await organizationRepository.requireById(input.organizationId);
    return brandRepository.create({
      organizationId: input.organizationId,
      name: input.name,
      slug: slugify(input.name),
      voiceConfig: input.voiceConfig,
    });
  },

  async listBrands(organizationId: string): Promise<Brand[]> {
    return brandRepository.listByOrganization(organizationId);
  },
};
