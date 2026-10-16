// Shared fetch helper for Cloud edge functions.
// The backend can be briefly unreachable under heavy mirroring load
// (Cloudflare 522/524, 502, 504 IDLE_TIMEOUT). Retry transient failures
// and never surface raw HTML error pages to the user.

const FRIENDLY_TRANSIENT =
  "Baza de date e temporar supraîncărcată. Se reîncearcă automat… dacă apare din nou, mai încearcă într-un minut.";

const FRIENDLY_UNAVAILABLE =
  "Serviciul de date nu răspunde momentan (de obicei e o pauză de câteva minute în timpul oglindirii). Mai încearcă puțin mai târziu.";

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504 || status === 522 || status === 524;
}

function looksLikeHtml(text: unknown): boolean {
  return typeof text === "string" && /<(!doctype|html|\?xml)/i.test(text.trim().slice(0, 200));
}

function friendlyMessage(status: number, raw: unknown): string {
  if (status === 504 && typeof raw === "string" && raw.includes("IDLE_TIMEOUT")) return FRIENDLY_TRANSIENT;
  if (isTransientStatus(status)) return looksLikeHtml(raw) || !raw ? FRIENDLY_UNAVAILABLE : String(raw);
  if (looksLikeHtml(raw)) return `Eroare ${status} de la server.`;
  if (typeof raw === "string" && raw.trim()) return raw;
  return `Eroare ${status}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface EdgeFetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  /** How many attempts total (default 3). */
  attempts?: number;
  /** Base delay between attempts in ms (default 2000, doubles each retry). */
  baseDelayMs?: number;
}

/** Fetch a Cloud edge function and return parsed JSON, retrying transient failures. */
export async function edgeFetchJson<T = any>(
  url: string,
  { method = "GET", headers = {}, body, attempts = 3, baseDelayMs = 2000 }: EdgeFetchOptions = {},
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: { ...headers, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const text = await res.text();
      let parsed: any = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text; // HTML error page or other non-JSON payload
        }
      }

      if (res.ok) return parsed as T;

      const rawError = parsed?.error ?? parsed;
      if (isTransientStatus(res.status) && attempt < attempts) {
        lastError = new Error(friendlyMessage(res.status, rawError));
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
        continue;
      }
      throw new Error(friendlyMessage(res.status, rawError));
    } catch (e) {
      // Network-level failure (fetch rejected): transient, retry.
      if (e instanceof TypeError && attempt < attempts) {
        lastError = new Error(FRIENDLY_UNAVAILABLE);
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
        continue;
      }
      throw e instanceof TypeError ? new Error(FRIENDLY_UNAVAILABLE) : e;
    }
  }

  throw lastError ?? new Error(FRIENDLY_UNAVAILABLE);
}
