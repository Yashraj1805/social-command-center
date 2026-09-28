import { query } from "../core/db.js";
import type { Platform } from "../domain/types/intents.js";
import type { Conversation, ConversationMessage } from "../domain/entities/conversation.js";
import { TenantScopedRepository, mapRows, optionalRow, requireRow } from "./base.repository.js";

class ConversationRepository extends TenantScopedRepository<Conversation> {
  protected table = "conversations";
  protected entityName = "Conversation";

  async findById(organizationId: string, id: string): Promise<Conversation | null> {
    return this.findByIdScoped(organizationId, id);
  }

  async findByExternalThread(
    platform: Platform,
    externalThreadId: string,
  ): Promise<Conversation | null> {
    const result = await query(
      `SELECT * FROM conversations WHERE platform = $1 AND external_thread_id = $2`,
      [platform, externalThreadId],
    );
    return optionalRow<Conversation>(result.rows);
  }

  async create(input: {
    organizationId: string;
    brandId: string;
    socialAccountId: string;
    customerId: string;
    postId?: string | null;
    campaignId?: string | null;
    platform: Platform;
    externalThreadId: string;
  }): Promise<Conversation> {
    const result = await query(
      `INSERT INTO conversations
         (organization_id, brand_id, social_account_id, customer_id, post_id, campaign_id, platform, external_thread_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.organizationId,
        input.brandId,
        input.socialAccountId,
        input.customerId,
        input.postId ?? null,
        input.campaignId ?? null,
        input.platform,
        input.externalThreadId,
      ],
    );
    return requireRow<Conversation>(result.rows);
  }

  async appendMessage(input: {
    conversationId: string;
    direction: "inbound" | "outbound";
    sender: "customer" | "ai" | "human";
    message: string;
    externalMessageId?: string | null;
  }): Promise<ConversationMessage> {
    const result = await query(
      `INSERT INTO conversation_messages (conversation_id, direction, sender, message, external_message_id, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $2 = 'outbound' THEN now() ELSE NULL END)
       RETURNING *`,
      [
        input.conversationId,
        input.direction,
        input.sender,
        input.message,
        input.externalMessageId ?? null,
        input.direction === "inbound" ? "received" : "sent",
      ],
    );
    await query(`UPDATE conversations SET last_message_at = now() WHERE id = $1`, [
      input.conversationId,
    ]);
    return requireRow<ConversationMessage>(result.rows);
  }

  /** Last N messages only -- token-efficiency rule from spec section 35/36:
   * never inject full conversation history into a prompt. Combine with
   * `conversations.summary` for anything older. */
  async recentMessages(conversationId: string, limit = 10): Promise<ConversationMessage[]> {
    const result = await query(
      `SELECT * FROM (
         SELECT * FROM conversation_messages WHERE conversation_id = $1
         ORDER BY created_at DESC LIMIT $2
       ) recent ORDER BY created_at ASC`,
      [conversationId, limit],
    );
    return mapRows<ConversationMessage>(result.rows);
  }
}

export const conversationRepository = new ConversationRepository();
