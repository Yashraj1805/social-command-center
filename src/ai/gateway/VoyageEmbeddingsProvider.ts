import { env } from "../../config/env.js";
import { ConfigurationError, UpstreamApiError } from "../../core/errors.js";
import type { AiGateway, EmbeddingsRequest, EmbeddingsResult } from "./AiGateway.js";

const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
}

/** Implements AiGateway's embeddings method against the Voyage AI API. Voyage
 * is the standard embeddings pairing for Anthropic-based RAG stacks (Anthropic
 * has no first-party embeddings endpoint). voyage-3 -> 1024-dim vectors,
 * matching the `vector(1024)` columns in migrations/0003_knowledge_and_rag.sql;
 * if VOYAGE_EMBEDDING_MODEL is changed to a different dimension, that
 * migration's column width has to change too. */
export class VoyageEmbeddingsProvider implements Pick<AiGateway, "embeddings"> {
  async embeddings(request: EmbeddingsRequest): Promise<EmbeddingsResult> {
    if (!env.VOYAGE_API_KEY) {
      throw new ConfigurationError(
        "VOYAGE_API_KEY is not set. Set it in .env to use the AI gateway's embeddings method.",
      );
    }

    const response = await fetch(VOYAGE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: request.input,
        model: env.VOYAGE_EMBEDDING_MODEL,
        input_type: "document",
      }),
    });

    if (!response.ok) {
      throw new UpstreamApiError("Voyage AI", `${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as VoyageResponse;
    const embeddings = [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);

    return { embeddings, model: body.model };
  }
}
