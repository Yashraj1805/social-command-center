export interface TextChunk {
  index: number;
  content: string;
  /** Rough token estimate (chars / 4), good enough for chunk-size budgeting;
   * exact counts come from the model provider's usage response on ai_runs. */
  approxTokenCount: number;
}

const DEFAULT_MAX_CHARS = 800;
const DEFAULT_OVERLAP_CHARS = 100;

/** Splits knowledge document content into overlapping chunks for embedding.
 * Splits on paragraph boundaries first, falling back to sentence boundaries,
 * so a chunk never cuts an offer/price sentence in half if avoidable. Pure
 * function -- no I/O, fully unit-testable. */
export function chunkText(
  text: string,
  options: { maxChars?: number; overlapChars?: number } = {},
): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const normalized = text.trim().replace(/\r\n/g, "\n");

  if (normalized.length === 0) return [];
  if (normalized.length <= maxChars) {
    return [{ index: 0, content: normalized, approxTokenCount: estimateTokens(normalized) }];
  }

  const units = splitIntoUnits(normalized);
  const chunks: TextChunk[] = [];
  let current = "";

  for (const unit of units) {
    const candidate = current ? `${current}\n\n${unit}` : unit;
    if (candidate.length > maxChars && current) {
      chunks.push(finalizeChunk(chunks.length, current));
      const overlap = current.slice(Math.max(0, current.length - overlapChars));
      current = `${overlap}\n\n${unit}`.trim();
    } else {
      current = candidate;
    }
  }
  if (current.trim().length > 0) {
    chunks.push(finalizeChunk(chunks.length, current));
  }

  return chunks;
}

function splitIntoUnits(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const units: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= DEFAULT_MAX_CHARS) {
      units.push(paragraph);
    } else {
      units.push(...(paragraph.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [paragraph]).map((s) => s.trim()));
    }
  }
  return units;
}

function finalizeChunk(index: number, content: string): TextChunk {
  const trimmed = content.trim();
  return { index, content: trimmed, approxTokenCount: estimateTokens(trimmed) };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
