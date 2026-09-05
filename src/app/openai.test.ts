import { describe, expect, it } from "vitest";
import { chunkTextForTTS } from "./openai";

describe("audio chunking", () => {
  it("returns no chunks for empty text", () => expect(chunkTextForTTS("   ")).toEqual([]));

  it("keeps every chunk inside the server TTS limit", () => {
    const source = Array.from({ length: 900 }, (_, i) => `Fjalia ${i} ka tekst mësimor.`).join(" ");
    const chunks = chunkTextForTTS(source);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length <= 3500)).toBe(true);
    expect(chunks.join(" ")).toBe(source);
  });
});

