-- Knowledge base + RAG storage (spec sections 8-11).
--
-- Vector dimension is fixed to the embedding model configured in .env
-- (VOYAGE_EMBEDDING_MODEL, default voyage-3 = 1024 dims). Changing embedding
-- models later requires a migration that adds a new vector column and
-- re-embeds -- pgvector columns are fixed-width.

CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Scope columns are nullable on purpose: a document scoped only to
  -- organization_id is general automotive knowledge (spec section 3, tier 5).
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
    'BRAND', 'DEALERSHIP', 'VEHICLE', 'SERVICE', 'OFFER', 'CAMPAIGN', 'POST',
    'FAQ', 'POLICY', 'INSURANCE', 'FINANCE', 'LOCATION', 'CONTACT', 'CONVERSATION'
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'pending_approval')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Metadata-first filtering (spec section 10/11): these are the columns every
-- retrieval query filters on *before* it touches the vector index.
CREATE INDEX idx_knowledge_documents_org ON knowledge_documents(organization_id);
CREATE INDEX idx_knowledge_documents_brand ON knowledge_documents(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_knowledge_documents_campaign ON knowledge_documents(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_knowledge_documents_post ON knowledge_documents(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_knowledge_documents_type ON knowledge_documents(knowledge_type);
CREATE TRIGGER trg_knowledge_documents_updated_at BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1024),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (knowledge_document_id, chunk_index)
);
CREATE INDEX idx_knowledge_chunks_document_id ON knowledge_chunks(knowledge_document_id);
-- Cosine similarity index for the semantic-search leg of hybrid retrieval.
-- Only built once rows exist in practice, but safe to declare empty.
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Generic embedding store for entities *outside* the knowledge base (e.g. post
-- captions, for "find similar past posts" or dedup) -- kept separate from
-- knowledge_chunks, which is the RAG source of truth read by the retrieval pipeline.
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  model TEXT NOT NULL,
  embedding vector(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id, model)
);
CREATE INDEX idx_embeddings_owner ON embeddings(owner_type, owner_id);

CREATE TABLE post_knowledge_links (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  knowledge_document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, knowledge_document_id)
);

CREATE TABLE campaign_knowledge_links (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  knowledge_document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, knowledge_document_id)
);

CREATE TABLE brand_knowledge_links (
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  knowledge_document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, knowledge_document_id)
);
