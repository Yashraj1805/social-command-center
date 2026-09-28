import { query } from "../core/db.js";
import { NotFoundError } from "../core/errors.js";
import type { Organization } from "../domain/entities/organization.js";
import { mapRows, optionalRow, requireRow } from "./base.repository.js";

export const organizationRepository = {
  async create(input: { name: string; slug: string }): Promise<Organization> {
    const result = await query(
      `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING *`,
      [input.name, input.slug],
    );
    return requireRow<Organization>(result.rows);
  },

  async findById(id: string): Promise<Organization | null> {
    const result = await query(`SELECT * FROM organizations WHERE id = $1`, [id]);
    return optionalRow<Organization>(result.rows);
  },

  async requireById(id: string): Promise<Organization> {
    const org = await this.findById(id);
    if (!org) throw new NotFoundError("Organization", id);
    return org;
  },

  async findBySlug(slug: string): Promise<Organization | null> {
    const result = await query(`SELECT * FROM organizations WHERE slug = $1`, [slug]);
    return optionalRow<Organization>(result.rows);
  },

  async list(): Promise<Organization[]> {
    const result = await query(`SELECT * FROM organizations ORDER BY name`);
    return mapRows<Organization>(result.rows);
  },
};
