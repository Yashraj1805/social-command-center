/** Business logic never calls a Meta Graph API endpoint directly (spec section
 * 5) -- everything goes through this interface. MetaProvider is the only
 * implementation today; a future provider (e.g. Google Business Profile
 * messaging) implements the same shape. */

export interface OAuthTokenResult {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number | null;
}

export interface RemotePage {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessAccountId: string | null;
}

export interface RemotePost {
  id: string;
  message: string | null;
  createdTime: string;
  permalinkUrl: string | null;
}

export interface RemoteComment {
  id: string;
  message: string;
  from: { id: string; name: string | null } | null;
  createdTime: string;
  parentId: string | null;
}

export interface RemoteConversation {
  id: string;
  participantId: string;
  updatedTime: string;
}

export interface RemoteMessage {
  id: string;
  from: string;
  message: string;
  createdTime: string;
}

export interface SocialProvider {
  /** Builds the Meta OAuth consent-screen URL for connecting a page (spec
   * section 5, endpoint POST /auth/meta/connect in section 48). */
  getOAuthUrl(state: string, scopes: string[]): string;
  exchangeCodeForToken(code: string): Promise<OAuthTokenResult>;

  getPages(userAccessToken: string): Promise<RemotePage[]>;
  getPagePosts(pageId: string, pageAccessToken: string): Promise<RemotePost[]>;
  getPostComments(postId: string, pageAccessToken: string): Promise<RemoteComment[]>;
  replyToComment(commentId: string, message: string, pageAccessToken: string): Promise<{ id: string }>;

  getInstagramMedia(igUserId: string, pageAccessToken: string): Promise<RemotePost[]>;
  getInstagramMediaComments(mediaId: string, pageAccessToken: string): Promise<RemoteComment[]>;
  replyToInstagramComment(commentId: string, message: string, pageAccessToken: string): Promise<{ id: string }>;

  getConversations(pageId: string, pageAccessToken: string): Promise<RemoteConversation[]>;
  sendMessage(pageId: string, recipientId: string, message: string, pageAccessToken: string): Promise<{ id: string }>;

  /** HMAC-SHA256 verification of X-Hub-Signature-256 against the raw request
   * body (spec sections 6, 30: webhook verification). */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;
  /** Handles the one-time GET verification handshake Meta performs when a
   * webhook subscription is first configured. */
  verifyWebhookChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): string | null;
}
