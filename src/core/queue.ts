import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { ConfigurationError } from "./errors.js";

let connection: Redis | null = null;

/** Shared ioredis connection for BullMQ. BullMQ requires `maxRetriesPerRequest: null`
 * on the connection it's given -- see https://docs.bullmq.io/guide/going-to-production. */
export function getRedisConnection(): Redis {
  if (!env.REDIS_URL) {
    throw new ConfigurationError(
      "REDIS_URL is not set. Copy .env.example to .env and run `docker-compose up -d`.",
    );
  }
  if (!connection) {
    connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
