import { AnthropicChatProvider } from "./AnthropicChatProvider.js";
import { VoyageEmbeddingsProvider } from "./VoyageEmbeddingsProvider.js";
import type { AiGateway } from "./AiGateway.js";

const chatProvider = new AnthropicChatProvider();
const embeddingsProvider = new VoyageEmbeddingsProvider();

/** The single AiGateway instance the rest of the app imports. Composed from
 * two providers because chat/structured-output and embeddings come from
 * different vendors (spec section 38/39) -- callers never need to know that. */
export const aiGateway: AiGateway = {
  chatCompletion: (req) => chatProvider.chatCompletion(req),
  structuredOutput: (req) => chatProvider.structuredOutput(req),
  embeddings: (req) => embeddingsProvider.embeddings(req),
};

export type { AiGateway } from "./AiGateway.js";
