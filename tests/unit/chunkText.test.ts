import { describe, expect, it } from "vitest";
import { chunkText } from "../../src/rag/chunking/chunkText.js";

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns a single chunk when text fits within maxChars", () => {
    const chunks = chunkText("Short offer text.", { maxChars: 800 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("Short offer text.");
    expect(chunks[0]?.index).toBe(0);
  });

  it("splits long text into multiple chunks with increasing indexes", () => {
    const paragraph = "The Fortuner service camp includes a complimentary twenty point inspection. ";
    const longText = Array.from({ length: 20 }, () => paragraph).join("\n\n");

    const chunks = chunkText(longText, { maxChars: 200, overlapChars: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });

  it("never drops content across chunk boundaries", () => {
    const longText = Array.from({ length: 10 }, (_, i) => `Paragraph number ${i} about the Innova HyCross.`).join(
      "\n\n",
    );
    const chunks = chunkText(longText, { maxChars: 100, overlapChars: 10 });
    const rejoined = chunks.map((c) => c.content).join(" ");

    for (let i = 0; i < 10; i += 1) {
      expect(rejoined).toContain(`Paragraph number ${i}`);
    }
  });
});
