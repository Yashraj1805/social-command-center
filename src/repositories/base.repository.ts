import type pg from "pg";
import { query } from "../core/db.js";
import { NotFoundError } from "../core/errors.js";

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Recursively converts snake_case object keys (as returned by `pg`) to
 * camelCase (as used by every domain entity in src/domain/entities). Leaves
 * arrays, Dates, and nested plain objects (jsonb columns) intact. */
export function mapRow<T>(row: Record<string, unknown>): T {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[toCamel(key)] = value;
  }
  return mapped as T;
}

export function mapRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => mapRow<T>(row));
}

/** For `INSERT ... RETURNING` / `UPDATE ... RETURNING` where exactly one row
 * is guaranteed. Centralizes the "we know this array isn't empty" assertion
 * instead of repeating `rows[0]!` (or fighting noUncheckedIndexedAccess) in
 * every repository. */
export function requireRow<T>(rows: Record<string, unknown>[]): T {
  const row = rows[0];
  if (!row) throw new Error("Expected at least one row, got none (RETURNING clause produced nothing)");
  return mapRow<T>(row);
}

/** For a `SELECT` that may or may not match a row. */
export function optionalRow<T>(rows: Record<string, unknown>[]): T | null {
  const row = rows[0];
  return row ? mapRow<T>(row) : null;
}

/** Base for any repository whose table is scoped to a single organization
 * (i.e. every table except `permissions`, which is global). Centralizes the
 * "never let one org read another org's row" rule (spec section 4) instead of
 * repeating `WHERE organization_id = $1` by hand in every repository method. */
export abstract class TenantScopedRepository<T> {
  protected abstract table: string;
  protected abstract entityName: string;

  protected async findByIdScoped(
    organizationId: string,
    id: string,
    client?: pg.PoolClient,
  ): Promise<T | null> {
    const sql = `SELECT * FROM ${this.table} WHERE id = $1 AND organization_id = $2`;
    const result = client
      ? await client.query(sql, [id, organizationId])
      : await query(sql, [id, organizationId]);
    const row = result.rows[0];
    return row ? mapRow<T>(row) : null;
  }

  protected async requireByIdScoped(
    organizationId: string,
    id: string,
    client?: pg.PoolClient,
  ): Promise<T> {
    const entity = await this.findByIdScoped(organizationId, id, client);
    if (!entity) throw new NotFoundError(this.entityName, id);
    return entity;
  }
}
