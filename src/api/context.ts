import type { FastifyRequest } from "fastify";
import { ValidationError } from "../core/errors.js";

/** TEMPORARY (Phase 1 only): there is no auth/RBAC middleware yet (spec
 * section 30's RBAC, deferred per the plan), so every request must identify
 * its organization explicitly via this header. Phase 2 replaces this with a
 * JWT-derived organization id from an authenticated session; every route
 * handler already calls this single function, so that swap touches one file. */
export function requireOrganizationId(request: FastifyRequest): string {
  const header = request.headers["x-organization-id"];
  const organizationId = Array.isArray(header) ? header[0] : header;
  if (!organizationId) {
    throw new ValidationError("Missing required X-Organization-Id header");
  }
  return organizationId;
}
