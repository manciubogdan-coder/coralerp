import { describe, expect, it } from "bun:test";
import { recognizedNote } from "../../src/lib/crm/voiceInput";

describe("CRM empty dictation", () => {
  it("does not throw or create text when recognition returns no results", () => {
    expect(recognizedNote({ results: [] })).toBe("");
    expect(recognizedNote({})).toBe("");
  });
  it("does not append whitespace from a silent recording", () => {
    expect(recognizedNote({ results: [[{ transcript: " \n " }]] })).toBe("");
  });
  it("retains a recognized Romanian note", () => {
    expect(recognizedNote({ results: [[{ transcript: "  Clientul dorește mostre.  " }]] })).toBe("Clientul dorește mostre.");
  });
});