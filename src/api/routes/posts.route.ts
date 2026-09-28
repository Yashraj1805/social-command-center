import type { FastifyInstance } from "fastify";
import { postService } from "../../services/post.service.js";
import { createPostSchema, updatePostContentSchema } from "../../schemas/posts.schemas.js";
import { requireOrganizationId } from "../context.js";

// GET/POST /posts, POST /posts/:id/... -- spec section 48. Publish-to-Meta
// (POST /posts/:id/publish) is intentionally not implemented yet: it depends
// on a connected, permission-approved social account (Phase 2).
export async function postRoutes(app: FastifyInstance): Promise<void> {
  app.post("/posts", async (request, reply) => {
    const organizationId = requireOrganizationId(request);
    const body = createPostSchema.parse(request.body);
    const result = await postService.createPost({ organizationId, ...body });
    reply.code(201);
    return result;
  });

  app.get("/posts", async (request) => {
    const organizationId = requireOrganizationId(request);
    const { brandId } = request.query as { brandId?: string };
    if (!brandId) {
      return { error: "brandId query parameter is required" };
    }
    return postService.listPosts(organizationId, brandId);
  });

  app.get("/posts/:id", async (request) => {
    const organizationId = requireOrganizationId(request);
    const { id } = request.params as { id: string };
    return postService.getPost(organizationId, id);
  });

  app.post("/posts/:id/versions", async (request) => {
    const organizationId = requireOrganizationId(request);
    const { id } = request.params as { id: string };
    const body = updatePostContentSchema.parse(request.body);
    return postService.updatePostContent({ organizationId, postId: id, ...body });
  });
}
