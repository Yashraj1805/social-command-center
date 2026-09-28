import type { FastifyInstance } from "fastify";
import { knowledgeService } from "../../services/knowledge.service.js";
import { createKnowledgeDocumentSchema } from "../../schemas/knowledge.schemas.js";
import { requireOrganizationId } from "../context.js";

// POST /knowledge, POST /knowledge/:id/disable -- spec section 42/48. Scope
// (brand/location/campaign/post) is whatever the caller passes; leaving all
// of them null creates general automotive knowledge (spec section 3, tier 5).
export async function knowledgeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/knowledge", async (request, reply) => {
    const organizationId = requireOrganizationId(request);
    const body = createKnowledgeDocumentSchema.parse(request.body);
    const document = await knowledgeService.createKnowledgeDocument({ organizationId, ...body });
    reply.code(201);
    return document;
  });

  app.post("/knowledge/:id/disable", async (request) => {
    const organizationId = requireOrganizationId(request);
    const { id } = request.params as { id: string };
    await knowledgeService.disableKnowledgeDocument(organizationId, id);
    return { status: "disabled" };
  });
}
