import type { FastifyInstance } from "fastify";
import { organizationService } from "../../services/organization.service.js";
import { createOrganizationSchema } from "../../schemas/organizations.schemas.js";

// POST /organizations, GET /organizations -- spec section 48's organization-
// level endpoints. Brand management lives in brands.route.ts.
export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/organizations", async (request, reply) => {
    const body = createOrganizationSchema.parse(request.body);
    const organization = await organizationService.createOrganization(body.name);
    reply.code(201);
    return organization;
  });
}
