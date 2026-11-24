/** No recognized speech is a recoverable recording state, not an application failure. */
export const NO_SPEECH_NOTICE = "Nu s-a înregistrat nicio întrebare. Verifică microfonul și încearcă din nou sau scrie întrebarea.";

export function transcriptText(result: string | { text: string }): string {
  return (typeof result === "string" ? result : result.text).trim();
}

export function speechRetryResponse(headers: HeadersInit): Response {
  return new Response(JSON.stringify({ status: "needs_audio", notice: NO_SPEECH_NOTICE }), {
    status: 200,
    headers: { ...Object.fromEntries(new Headers(headers)), "Content-Type": "application/json" },
  });
}