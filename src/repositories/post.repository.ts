import { query, withTransaction } from "../core/db.js";
import type { Platform } from "../domain/types/intents.js";
import type { Post, PostVersion, PostVersionMetadata } from "../domain/entities/post.js";
import { TenantScopedRepository, mapRow, mapRows, optionalRow } from "./base.repository.js";

class PostRepository extends TenantScopedRepository<Post> {
  protected table = "posts";
  protected entityName = "Post";

  async findById(organizationId: string, id: string): Promise<Post | null> {
    return this.findByIdScoped(organizationId, id);
  }

  async requireById(organizationId: string, id: string): Promise<Post> {
    return this.requireByIdScoped(organizationId, id);
  }

  async listByBrand(organizationId: string, brandId: string): Promise<Post[]> {
    const result = await query(
      `SELECT * FROM posts WHERE organization_id = $1 AND brand_id = $2 ORDER BY created_at DESC`,
      [organizationId, brandId],
    );
    return mapRows<Post>(result.rows);
  }

  /** Creates a post and its first version in one transaction, and points
   * `posts.active_version_id` at it -- a post is never left without an active
   * version (spec section 34). */
  async createWithFirstVersion(input: {
    organizationId: string;
    brandId: string;
    socialAccountId: string;
    campaignId?: string | null;
    platform: Platform;
    caption: string;
    media?: Array<{ type: "image" | "video"; url: string }>;
    metadata?: PostVersionMetadata;
    createdByUserId?: string | null;
  }): Promise<{ post: Post; version: PostVersion }> {
    return withTransaction(async (client) => {
      const postResult = await client.query(
        `INSERT INTO posts (organization_id, brand_id, social_account_id, campaign_id, platform, status)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         RETURNING *`,
        [input.organizationId, input.brandId, input.socialAccountId, input.campaignId ?? null, input.platform],
      );
      const post = mapRow<Post>(postResult.rows[0]);

      const versionResult = await client.query(
        `INSERT INTO post_versions (post_id, version_number, caption, media, metadata, created_by_user_id)
         VALUES ($1, 1, $2, $3, $4, $5)
         RETURNING *`,
        [
          post.id,
          input.caption,
          JSON.stringify(input.media ?? []),
          JSON.stringify(input.metadata ?? {}),
          input.createdByUserId ?? null,
        ],
      );
      const version = mapRow<PostVersion>(versionResult.rows[0]);

      const updated = await client.query(
        `UPDATE posts SET active_version_id = $1 WHERE id = $2 RETURNING *`,
        [version.id, post.id],
      );

      return { post: mapRow<Post>(updated.rows[0]), version };
    });
  }

  /** Adds a new version and re-points active_version_id at it -- the old
   * version stays in post_versions for history, but stops being used for AI
   * context generation immediately (spec section 34). */
  async addVersion(input: {
    postId: string;
    caption: string;
    media?: Array<{ type: "image" | "video"; url: string }>;
    metadata?: PostVersionMetadata;
    createdByUserId?: string | null;
  }): Promise<PostVersion> {
    return withTransaction(async (client) => {
      const nextVersion = await client.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM post_versions WHERE post_id = $1`,
        [input.postId],
      );
      const versionNumber = nextVersion.rows[0].next as number;

      const versionResult = await client.query(
        `INSERT INTO post_versions (post_id, version_number, caption, media, metadata, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.postId,
          versionNumber,
          input.caption,
          JSON.stringify(input.media ?? []),
          JSON.stringify(input.metadata ?? {}),
          input.createdByUserId ?? null,
        ],
      );
      const version = mapRow<PostVersion>(versionResult.rows[0]);

      await client.query(`UPDATE posts SET active_version_id = $1 WHERE id = $2`, [
        version.id,
        input.postId,
      ]);

      return version;
    });
  }

  async getActiveVersion(postId: string): Promise<PostVersion | null> {
    const result = await query(
      `SELECT pv.* FROM post_versions pv
       JOIN posts p ON p.active_version_id = pv.id
       WHERE p.id = $1`,
      [postId],
    );
    return optionalRow<PostVersion>(result.rows);
  }
}

export const postRepository = new PostRepository();
