-- AI observability + human approval, content generation, scheduling, and ops tables
-- (spec sections 16, 18-21, 29, 30, 47).

CREATE TABLE ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('customer_reply', 'intent_classification', 'content_generation', 'fact_check')),
  model TEXT NOT NULL,
  temperature NUMERIC(3, 2) NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  prompt_version TEXT NOT NULL,
  -- What was actually retrieved and handed to the model, for debugging bad answers
  -- (spec section 29). Never the full DB row set -- just the assembled context.
  retrieved_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  request JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_runs_brand_id ON ai_runs(brand_id);
CREATE INDEX idx_ai_runs_related_entity ON ai_runs(related_entity_type, related_entity_id);

CREATE TABLE ai_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_run_id UUID NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('comment', 'conversation_message')),
  target_id UUID NOT NULL,
  intent TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  lead_intent TEXT CHECK (lead_intent IN ('high', 'medium', 'low', 'none')),
  requires_human BOOLEAN NOT NULL DEFAULT true,
  reason_for_human TEXT,
  reply_text TEXT NOT NULL,
  source_context TEXT NOT NULL CHECK (source_context IN ('post', 'campaign', 'brand', 'unknown')),
  confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited', 'rejected', 'sent')),
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_replies_brand_id ON ai_replies(brand_id);
CREATE INDEX idx_ai_replies_target ON ai_replies(target_type, target_id);
CREATE INDEX idx_ai_replies_status ON ai_replies(status);
CREATE TRIGGER trg_ai_replies_updated_at BEFORE UPDATE ON ai_replies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE comment_replies
  ADD CONSTRAINT fk_comment_replies_ai_reply FOREIGN KEY (ai_reply_id)
  REFERENCES ai_replies(id) ON DELETE SET NULL;

ALTER TABLE conversation_messages
  ADD CONSTRAINT fk_conversation_messages_ai_reply FOREIGN KEY (ai_reply_id)
  REFERENCES ai_replies(id) ON DELETE SET NULL;

CREATE TABLE ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_reply_id UUID NOT NULL REFERENCES ai_replies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'edit', 'reject', 'regenerate')),
  edited_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_feedback_ai_reply_id ON ai_feedback(ai_reply_id);

CREATE TABLE content_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'blog', 'instagram_caption', 'facebook_caption', 'short_caption', 'long_caption',
    'carousel_copy', 'reel_script', 'story_copy', 'cta', 'hashtags', 'seo_title',
    'meta_description', 'faq', 'campaign_copy'
  )),
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'fact_check_failed', 'approved', 'published')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_generations_brand_id ON content_generations(brand_id);
CREATE TRIGGER trg_content_generations_updated_at BEFORE UPDATE ON content_generations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_generation_id UUID NOT NULL REFERENCES content_generations(id) ON DELETE CASCADE,
  -- e.g. "Professional", "Conversational", "High-engagement", "Local/Hinglish", "SEO-focused"
  variant_label TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  -- Result of the pre-publish factual validation step (spec section 21).
  fact_check_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_versions_generation_id ON content_versions(content_generation_id);

CREATE TABLE scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  content_version_id UUID REFERENCES content_versions(id) ON DELETE SET NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'publishing', 'published', 'failed', 'canceled')),
  published_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_posts_brand_id ON scheduled_posts(brand_id);
CREATE INDEX idx_scheduled_posts_status_scheduled_at ON scheduled_posts(status, scheduled_at);
CREATE TRIGGER trg_scheduled_posts_updated_at BEFORE UPDATE ON scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Idempotency + audit trail for every inbound Meta webhook delivery (spec
-- sections 6, 31, 54: never process the same event twice, never lose the raw payload).
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  event_type TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'duplicate')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error TEXT,
  UNIQUE (platform, external_event_id)
);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before JSONB,
  after JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_org_entity ON audit_logs(organization_id, entity_type, entity_id);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id) WHERE read_at IS NULL;

-- Generic scoped key/value config: auto-reply intents, human-approval intents,
-- min confidence, business hours, escalation rules (spec section 17), brand
-- voice overrides, etc. brand_id NULL = organization-level default.
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, brand_id, key)
);
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
