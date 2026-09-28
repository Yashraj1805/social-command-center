import type { z } from "zod";

/** Nothing outside this folder is allowed to import an AI SDK directly (spec
 * section 38) -- every chat/structured-output/embeddings call in the app goes
 * through this interface so swapping model providers later is a one-file
 * change (AnthropicChatProvider.ts / VoyageEmbeddingsProvider.ts), not a
 * codebase-wide search-and-replace. */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  systemPrompt: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface StructuredOutputRequest<T> extends ChatCompletionRequest {
  schema: z.ZodType<T>;
  /** Human-readable description of the schema injected into the prompt (the
   * model sees this, not the zod internals) -- see ai/prompts/customerReplyPrompt.ts
   * for the section-15 contract this is used for. */
  schemaDescription: string;
}

export interface StructuredOutputResult<T> extends ChatCompletionResult {
  data: T;
}

export interface EmbeddingsRequest {
  input: string[];
}

export interface EmbeddingsResult {
  embeddings: number[][];
  model: string;
}

export interface AiGateway {
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
  structuredOutput<T>(request: StructuredOutputRequest<T>): Promise<StructuredOutputResult<T>>;
  embeddings(request: EmbeddingsRequest): Promise<EmbeddingsResult>;
}
