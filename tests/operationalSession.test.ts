import { expect, test } from "bun:test";
import { EdgeFetchError, edgeFetchJson } from "../src/lib/edgeFetch";
import { operationalToken, withOperationalSession } from "../src/lib/operationalSession";

function auth(expires_at = Date.now() / 1000 + 3600) {
  let token = "old-test-token";
  let refreshCount = 0;
  return {
    getSession: async () => ({ data: { session: { access_token: token, expires_at } }, error: null }),
    refreshSession: async () => {
      refreshCount++;
      token = "refreshed-test-token";
      return { data: { session: { access_token: token } }, error: null };
    },
    count: () => refreshCount,
  };
}

test("a current operational token is used without a refresh", async () => {
  const client = auth();
  expect(await operationalToken(client)).toBe("old-test-token");
  expect(client.count()).toBe(0);
});

test("near-expiry concurrent requests share one refresh", async () => {
  const client = auth(Date.now() / 1000 + 30);
  expect(await Promise.all([operationalToken(client), operationalToken(client)])).toEqual(["refreshed-test-token", "refreshed-test-token"]);
  expect(client.count()).toBe(1);
});

test("future scan retries a rejected session once and reads back its result", async () => {
  const client = auth();
  const sent: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url, options) => {
    const token = (options?.headers as Record<string, string>)["x-app-token"];
    sent.push(token);
    return token === "old-test-token"
      ? new Response(JSON.stringify({ error: "Sesiune invalidă. Reautentifică-te." }), { status: 401 })
      : new Response(JSON.stringify({ checkedAt: "2026-11-25", items: [], levers: {} }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await withOperationalSession(client, token => edgeFetchJson<{ checkedAt: string }>("https://example.test/argus?action=future_scan", {
      method: "POST", headers: { "x-app-token": token }, body: {},
    }));
    expect(result.checkedAt).toBe("2026-11-25");
    expect(sent).toEqual(["old-test-token", "refreshed-test-token"]);
    expect(client.count()).toBe(1);
  } finally { globalThis.fetch = originalFetch; }
});

test("a second 401 stops rather than looping", async () => {
  const client = auth();
  let calls = 0;
  await expect(withOperationalSession(client, async () => {
    calls++;
    throw new EdgeFetchError("invalid session", 401);
  })).rejects.toThrow("invalid session");
  expect(calls).toBe(2);
  expect(client.count()).toBe(1);
});

test("403 permissions and other failures never refresh or replay actions", async () => {
  for (const status of [403, 400, 500]) {
    const client = auth();
    let calls = 0;
    await expect(withOperationalSession(client, async () => {
      calls++;
      throw new EdgeFetchError("denied", status);
    })).rejects.toThrow("denied");
    expect(calls).toBe(1);
    expect(client.count()).toBe(0);
  }
});

test("no session stops before sending a request", async () => {
  let calls = 0;
  const client = { getSession: async () => ({ data: { session: null }, error: null }), refreshSession: auth().refreshSession };
  await expect(withOperationalSession(client, async () => { calls++; })).rejects.toThrow("Autentifică-te");
  expect(calls).toBe(0);
});

test("a failed refresh stops without replaying the rejected action", async () => {
  let calls = 0;
  const client = { ...auth(), refreshSession: async () => ({ data: { session: null }, error: new Error("expired") }) };
  await expect(withOperationalSession(client, async () => {
    calls++;
    throw new EdgeFetchError("invalid", 401);
  })).rejects.toThrow("Autentifică-te");
  expect(calls).toBe(1);
});