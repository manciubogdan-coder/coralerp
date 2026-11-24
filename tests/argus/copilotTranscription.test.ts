import { describe, expect, it } from "bun:test";
import { speechRetryResponse, transcriptText } from "../../supabase/functions/_shared/copilotTranscription";

describe("Viziune microphone transcription", () => {
  it("treats the reported empty transcript as a recoverable recording, not HTTP 400", async () => {
    expect(transcriptText({ text: "" })).toBe("");
    const response = speechRetryResponse({ "Access-Control-Allow-Origin": "*" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const result = await response.json();
    expect(result.status).toBe("needs_audio");
    expect(result.error).toBeUndefined();
    expect(result.answer).toBeUndefined();
  });

  it("accepts a Romanian question from the JSON transcription contract", () => {
    expect(transcriptText({ text: "  Care e media consumului de rucola?  " })).toBe("Care e media consumului de rucola?");
  });

  it("accepts the text variant of the transcription contract", () => {
    expect(transcriptText("  Cum stăm cu producția azi?\n")).toBe("Cum stăm cu producția azi?");
  });

  it("does not invent a question for a whitespace-only recording", () => {
    expect(transcriptText({ text: " \n\t " })).toBe("");
  });
});