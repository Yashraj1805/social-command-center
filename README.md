# Social Command Center — Phase 1

Backend for the Automotive Social Media AI Command Center (Galaxy Toyota, Hans
Hyundai, Auto Car Repair). This is **Phase 1 only**: database schema,
multi-tenant model, and core service/provider abstractions. There is no
frontend yet, and Meta's write/publish endpoints are implemented against the
documented Graph API shape but unverified against a real app (see "What's
real vs. stubbed" below).

This is a separate app from the existing Next.js GMB review dashboard in
`../src` — that app is untouched.

## Setup

```bash
npm install
cp .env.example .env        # fill in real secrets as you get them
docker-compose up -d        # Postgres (pgvector) + Redis
npm run migrate              # applies migrations/000*.sql
npm run dev                  # Fastify on :4000, with the embedding worker
```

`GET /health` works with zero configuration. Every other route needs
`DATABASE_URL` (and most need `X-Organization-Id` — see below); the AI
gateway and Meta provider also need their respective API keys.

## Running tests

```bash
npm test
```

Runs `tests/unit/*` — pure-logic tests for the context-priority assembler,
hybrid ranking, and text chunker. These need no database, Redis, or API keys.
There are no integration tests yet; once you have `docker-compose up` working
locally, the next thing to add is a repository-level test suite against a
real (or testcontainers) Postgres instance.

## Temporary auth shim

There is no auth/RBAC yet (that's Phase 2). Every route below "organizations"
reads the requesting organization from an `X-Organization-Id: <uuid>` header
instead of a session. See `src/api/context.ts` — this is the one place that
changes when real auth lands.

## What's real vs. stubbed in this phase

**Implemented and runnable once you have Postgres + Redis + API keys:**
- Full schema for all ~30 tables (`migrations/`), with tenant isolation via
  `organization_id`/`brand_id` and a pgvector column on `knowledge_chunks`.
- Repository + service pattern for organizations, brands, social accounts,
  posts (+versions), knowledge documents, and conversations.
- Post ingestion: creating a post derives a linked `POST`-scoped knowledge
  document and enqueues it for chunking + embedding.
- Context-priority assembler and hybrid ranking (`src/rag/`) — pure functions,
  fully unit-tested, encoding spec's most important rule: post context always
  wins over conflicting lower-priority context, tiers are never merged.
- AI gateway: real Anthropic chat/structured-output calls, real Voyage AI
  embeddings calls, both behind one interface (`src/ai/gateway`).
- Meta webhook endpoint: real HMAC-SHA256 signature verification, fast ack,
  durable enqueue — no synchronous AI call in the request path.
- `embedding_queue` has a real BullMQ worker wired end-to-end.

**Explicitly deferred to the next phase:**
- The other 8 queues (`src/workers/queues.ts`) are declared but have no
  worker yet — comment/message processing, publishing, analytics, etc.
- The actual RAG retrieval SQL (metadata filter + pgvector cosine query) that
  would feed `rankContext` real candidates from the database. The schema and
  ranking logic exist; wiring a route to them is next.
- Meta's write endpoints (`replyToComment`, `sendMessage`, publish) are coded
  against Meta's documented request/response shapes but require a real app
  with approved permissions to verify end-to-end.
- Auth/RBAC middleware, human-approval UI, content studio, dashboard.
- Repositories/routes for the ~24 tables beyond the 6 implemented here — same
  pattern, not yet written (audit_logs, ai_runs, leads, scheduled_posts, ...).

## Layout

See `src/` for the clean-architecture split: `domain` (types only, no I/O),
`repositories` (SQL), `services` (business logic), `providers/social` (Meta),
`ai` (gateway/prompts/classifiers), `rag` (retrieval/ranking/chunking),
`workers` (BullMQ), `api` (Fastify routes + zod schemas).
