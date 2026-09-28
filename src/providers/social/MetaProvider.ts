import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { ConfigurationError, UpstreamApiError } from "../../core/errors.js";
import type {
  OAuthTokenResult,
  RemoteComment,
  RemoteConversation,
  RemotePage,
  RemotePost,
  SocialProvider,
} from "./SocialProvider.js";

/** Real implementation against the Meta Graph API (Facebook + Instagram).
 * GET-only methods (getPages, getPagePosts, getPostComments, getInstagramMedia,
 * getInstagramMediaComments) follow Meta's documented, stable response shapes
 * and can be exercised as soon as a real user/page access token is available.
 * Write methods (replyToComment, sendMessage, ...) are implemented the same
 * way but additionally require the app to have been granted the relevant
 * permission (e.g. pages_manage_engagement) through Meta App Review before
 * they'll succeed against a real page -- see spec section 53. Nothing here
 * fabricates a response shape; every field mapped below comes from Meta's
 * public Graph API reference for the endpoint in the adjacent comment. */
export class MetaProvider implements SocialProvider {
  private get baseUrl(): string {
    return `https://graph.facebook.com/${env.META_API_VERSION}`;
  }

  private requireAppCredentials(): { appId: string; appSecret: string } {
    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      throw new ConfigurationError(
        "META_APP_ID / META_APP_SECRET are not set. Create an app at https://developers.facebook.com/apps and fill in .env.",
      );
    }
    return { appId: env.META_APP_ID, appSecret: env.META_APP_SECRET };
  }

  getOAuthUrl(state: string, scopes: string[]): string {
    const { appId } = this.requireAppCredentials();
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: env.META_OAUTH_REDIRECT_URI,
      state,
      scope: scopes.join(","),
      response_type: "code",
    });
    return `https://www.facebook.com/${env.META_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<OAuthTokenResult> {
    const { appId, appSecret } = this.requireAppCredentials();
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: env.META_OAUTH_REDIRECT_URI,
      code,
    });
    const body = await this.getJson<{ access_token: string; token_type: string; expires_in?: number }>(
      `/oauth/access_token?${params.toString()}`,
    );
    return {
      accessToken: body.access_token,
      tokenType: body.token_type,
      expiresInSeconds: body.expires_in ?? null,
    };
  }

  // GET /me/accounts -- pages the connected user manages, with each page's own
  // access token and linked Instagram Business Account id.
  async getPages(userAccessToken: string): Promise<RemotePage[]> {
    const body = await this.getJson<{
      data: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>;
    }>(`/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(userAccessToken)}`);

    return body.data.map((page) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      instagramBusinessAccountId: page.instagram_business_account?.id ?? null,
    }));
  }

  // GET /{page-id}/posts
  async getPagePosts(pageId: string, pageAccessToken: string): Promise<RemotePost[]> {
    const body = await this.getJson<{
      data: Array<{ id: string; message?: string; created_time: string; permalink_url?: string }>;
    }>(`/${pageId}/posts?fields=id,message,created_time,permalink_url&access_token=${encodeURIComponent(pageAccessToken)}`);

    return body.data.map((post) => ({
      id: post.id,
      message: post.message ?? null,
      createdTime: post.created_time,
      permalinkUrl: post.permalink_url ?? null,
    }));
  }

  // GET /{post-id}/comments
  async getPostComments(postId: string, pageAccessToken: string): Promise<RemoteComment[]> {
    const body = await this.getJson<{
      data: Array<{
        id: string;
        message: string;
        from?: { id: string; name?: string };
        created_time: string;
        parent?: { id: string };
      }>;
    }>(`/${postId}/comments?fields=id,message,from,created_time,parent&access_token=${encodeURIComponent(pageAccessToken)}`);

    return body.data.map((comment) => ({
      id: comment.id,
      message: comment.message,
      from: comment.from ? { id: comment.from.id, name: comment.from.name ?? null } : null,
      createdTime: comment.created_time,
      parentId: comment.parent?.id ?? null,
    }));
  }

  // POST /{comment-id}/comments -- replying to a Facebook comment publishes a
  // reply comment. Requires pages_manage_engagement.
  async replyToComment(commentId: string, message: string, pageAccessToken: string): Promise<{ id: string }> {
    return this.postForm<{ id: string }>(`/${commentId}/comments`, { message }, pageAccessToken);
  }

  // GET /{ig-user-id}/media
  async getInstagramMedia(igUserId: string, pageAccessToken: string): Promise<RemotePost[]> {
    const body = await this.getJson<{
      data: Array<{ id: string; caption?: string; timestamp: string; permalink?: string }>;
    }>(`/${igUserId}/media?fields=id,caption,timestamp,permalink&access_token=${encodeURIComponent(pageAccessToken)}`);

    return body.data.map((media) => ({
      id: media.id,
      message: media.caption ?? null,
      createdTime: media.timestamp,
      permalinkUrl: media.permalink ?? null,
    }));
  }

  // GET /{ig-media-id}/comments
  async getInstagramMediaComments(mediaId: string, pageAccessToken: string): Promise<RemoteComment[]> {
    const body = await this.getJson<{
      data: Array<{ id: string; text: string; username?: string; timestamp: string }>;
    }>(`/${mediaId}/comments?fields=id,text,username,timestamp&access_token=${encodeURIComponent(pageAccessToken)}`);

    return body.data.map((comment) => ({
      id: comment.id,
      message: comment.text,
      from: comment.username ? { id: comment.username, name: comment.username } : null,
      createdTime: comment.timestamp,
      parentId: null,
    }));
  }

  // POST /{ig-comment-id}/replies -- requires instagram_manage_comments.
  async replyToInstagramComment(commentId: string, message: string, pageAccessToken: string): Promise<{ id: string }> {
    return this.postForm<{ id: string }>(`/${commentId}/replies`, { message }, pageAccessToken);
  }

  // GET /{page-id}/conversations -- Messenger threads for the page.
  async getConversations(pageId: string, pageAccessToken: string): Promise<RemoteConversation[]> {
    const body = await this.getJson<{
      data: Array<{ id: string; updated_time: string; participants: { data: Array<{ id: string }> } }>;
    }>(`/${pageId}/conversations?fields=id,updated_time,participants&access_token=${encodeURIComponent(pageAccessToken)}`);

    return body.data.map((conversation) => ({
      id: conversation.id,
      participantId: conversation.participants.data.find((p) => p.id !== pageId)?.id ?? "",
      updatedTime: conversation.updated_time,
    }));
  }

  // POST /{page-id}/messages -- requires pages_messaging.
  async sendMessage(
    pageId: string,
    recipientId: string,
    message: string,
    pageAccessToken: string,
  ): Promise<{ id: string }> {
    return this.postForm<{ id: string }>(
      `/${pageId}/messages`,
      { recipient: JSON.stringify({ id: recipientId }), message: JSON.stringify({ text: message }) },
      pageAccessToken,
    );
  }

  /** X-Hub-Signature-256 verification per Meta's documented webhook scheme:
   * the header is `sha256=<hex hmac of the raw body, keyed by the app secret>`.
   * Uses a constant-time comparison to avoid a timing side-channel. */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
    const { appSecret } = this.requireAppCredentials();

    const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
    const provided = signatureHeader.slice("sha256=".length);

    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(provided, "hex");
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  }

  verifyWebhookChallenge(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): string | null {
    if (mode === "subscribe" && token && token === env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
      return challenge;
    }
    return null;
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new UpstreamApiError("Meta Graph API", `${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  private async postForm<T>(path: string, fields: Record<string, string>, accessToken: string): Promise<T> {
    const body = new URLSearchParams({ ...fields, access_token: accessToken });
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new UpstreamApiError("Meta Graph API", `${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }
}

export const metaProvider = new MetaProvider();
