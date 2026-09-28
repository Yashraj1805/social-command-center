import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { ConfigurationError, ValidationError } from "../../core/errors.js";
import { logger } from "../../core/logger.js";
import type {
  AiGateway,
  ChatCompletionRequest,
  ChatCompletionResult,
  StructuredOutputRequest,
  StructuredOutputResult,
} from "./AiGateway.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ConfigurationError(
      "ANTHROPIC_API_KEY is not set. Set it in .env to use the AI gateway's chat/structured-output methods.",
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** Implements AiGateway's chat + structured-output methods against the
 * Anthropic Messages API. (Embeddings are NOT implemented here -- Anthropic
 * has no embeddings endpoint; see VoyageEmbeddingsProvider.ts.) */
export class AnthropicChatProvider implements Pick<AiGateway, "chatCompletion" | "structuredOutput"> {
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const start = Date.now();
    const response = await getClient().messages.create({
      model: env.ANTHROPIC_CHAT_MODEL,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature,
      system: request.systemPrompt,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return {
      text,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - start,
    };
  }

  /** Asks the model to reply with JSON matching `schemaDescription`, then
   * validates the reply with the caller's zod schema. Retries once (with the
   * parse error fed back to the model) before giving up -- structured-output
   * failures should surface as a validation error the caller routes to human
   * review (spec section 21/57), never as a silently wrong object. */
  async structuredOutput<T>(request: StructuredOutputRequest<T>): Promise<StructuredOutputResult<T>> {
    const jsonInstruction = `Respond with ONLY a single JSON object matching this shape, no prose before or after:\n${request.schemaDescription}`;
    let messages = [...request.messages];
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await this.chatCompletion({
        ...request,
        systemPrompt: `${request.systemPrompt}\n\n${jsonInstruction}`,
        messages,
      });

      try {
        const parsed = JSON.parse(extractJson(result.text));
        const data = request.schema.parse(parsed);
        return { ...result, data };
      } catch (err) {
        lastError = err;
        logger.warn({ err, attempt }, "structured output validation failed, retrying");
        messages = [
          ...messages,
          { role: "assistant", content: result.text },
          {
            role: "user",
            content: `That response was not valid JSON matching the required shape (${(err as Error).message}). Reply again with ONLY the corrected JSON object.`,
          },
        ];
      }
    }

    throw new ValidationError(
      `Model did not return valid structured output after retry: ${(lastError as Error)?.message}`,
    );
  }
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}
