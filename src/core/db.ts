import pg from "pg";
import { env } from "../config/env.js";
import { ConfigurationError } from "./errors.js";

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!env.DATABASE_URL) {
    throw new ConfigurationError(
      "DATABASE_URL is not set. Copy .env.example to .env, run `docker-compose up -d`, then `npm run migrate`.",
    );
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  }
  return pool;
}

/** Thin query helper. Every repository goes through this, never through a raw
 * pool import, so connection lifecycle and (later) query logging/metrics stay
 * in one place. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}

/** Runs `fn` inside a transaction, committing on success and rolling back on
 * any thrown error. Use for any write that touches more than one table. */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
