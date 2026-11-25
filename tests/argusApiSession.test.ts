import { afterEach, expect, mock, test } from "bun:test";

let token = "expired-test-session";
let refreshes = 0;
const auth = {
  getSession: async () => ({ data: { session: { access_token: token, expires_at: Date.now() / 1000 + 3600 } }, error: null }),
  refreshSession: async () => {
    refreshes++;
    token = "fresh-test-session";
    return { data: { session: { access_token: token } }, error: null };
  },
};
mock.module("@/integrations/supabase/client", () => ({ supabase: { auth } }));
const { ARGUS_URL, argusFetch, argusRequest } = await import("../src/lib/argusApi");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; token = "expired-test-session"; refreshes = 0; });

test("the actual future_scan client refreshes 401 and preserves its POST body", async () => {
  const seen: Array<{ token: string; body: string; method: string }> = [];
  globalThis.fetch = (async (_input, init) => {
    const headers = new Headers(init?.headers);
    seen.push({ token: headers.get("x-app-token") ?? "", body: String(init?.body), method: init?.method ?? "" });
    return headers.get("x-app-token") === "expired-test-session"
      ? Response.json({ error: "Sesiune invalidă. Reautentifică-te." }, { status: 401 })
      : Response.json({ items: [], levers: {}, checkedAt: "2026-11-25" });
  }) as typeof fetch;
  const result = await argusFetch<{ checkedAt: string }>("future_scan", {}, {});
  expect(result.checkedAt).toBe("2026-11-25");
  expect(seen).toEqual([
    { token: "expired-test-session", body: "{}", method: "POST" },
    { token: "fresh-test-session", body: "{}", method: "POST" },
  ]);
  expect(refreshes).toBe(1);
});

test("chat and voice stream recovery leaves the successful response readable", async () => {
  for (const action of ["chat", "viziune_voice_stream"]) {
    token = "expired-test-session";
    const bodies: string[] = [];
    globalThis.fetch = (async input => {
      const request = input as Request;
      bodies.push(await request.text());
      return request.headers.get("x-app-token") === "expired-test-session"
        ? Response.json({ error: "invalid" }, { status: 401 })
        : new Response("streamed-answer", { headers: { "Content-Type": "text/event-stream" } });
    }) as typeof fetch;
    const response = await argusRequest(`${ARGUS_URL}?action=${action}`, { method: "POST", body: JSON.stringify({ text: "question" }) });
    expect(response.bodyUsed).toBe(false);
    expect(await response.text()).toBe("streamed-answer");
    expect(bodies).toEqual(['{"text":"question"}', '{"text":"question"}']);
  }
});

test("an attachment upload can refresh without losing its file or multipart boundary", async () => {
  const contents: string[] = [];
  globalThis.fetch = (async input => {
    const request = input as Request;
    expect(request.headers.get("Content-Type")).toContain("multipart/form-data; boundary=");
    const form = await request.formData();
    const file = form.get("file");
    contents.push(file instanceof Blob ? await file.text() : "missing");
    return request.headers.get("x-app-token") === "expired-test-session"
      ? Response.json({ error: "invalid" }, { status: 401 })
      : Response.json({ filename: "sample.txt" });
  }) as typeof fetch;
  const form = new FormData();
  form.append("file", new File(["sample contents"], "sample.txt"));
  const response = await argusRequest(`${ARGUS_URL}?action=attachment_upload`, { method: "POST", body: form });
  expect(await response.json()).toEqual({ filename: "sample.txt" });
  expect(contents).toEqual(["sample contents", "sample contents"]);
  expect(refreshes).toBe(1);
});

test("operational session credentials are never sent to an unrelated destination", async () => {
  let sent = false;
  globalThis.fetch = (async () => { sent = true; return new Response(); }) as typeof fetch;
  await expect(argusRequest("https://example.test/argus")).rejects.toThrow("Destinație neacceptată");
  expect(sent).toBe(false);
  expect(refreshes).toBe(0);
});