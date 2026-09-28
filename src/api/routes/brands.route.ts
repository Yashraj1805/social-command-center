import type { FastifyInstance } from "fastify";
import { organizationService } from "../../services/organization.service.js";
import { createBrandSchema } from "../../schemas/organizations.schemas.js";
import { requireOrganizationId } from "../context.js";

export async function brandRoutes(app: FastifyInstance): Promise<void> {
  app.post("/brands", async (request, reply) => {
    const organizationId = requireOrganizationId(request);
    const body = createBrandSchema.parse(request.body);
    const brand = await organizationService.createBrand({
      organizationId,
      name: body.name,
      voiceConfig: body.voiceConfig,
    });
    reply.code(201);
    return brand;
  });

  app.get("/brands", async (request) => {
    const organizationId = requireOrganizationId(request);
    return organizationService.listBrands(organizationId);
  });
}
