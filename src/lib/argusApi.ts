import { supabase } from "@/integrations/supabase/client";
import { edgeFetchJson, type EdgeFetchOptions } from "@/lib/edgeFetch";
import { operationalToken, withOperationalSession, withOperationalResponse } from "@/lib/operationalSession";

const CLOUD_URL = "https://yeniohmlmxhjzywqlidx.supabase.co";
const CLOUD_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbmlvaG1sbXhoanp5d3FsaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjM0ODgsImV4cCI6MjA5MzEzOTQ4OH0.8rNaYX5D5hk22o_bUqERO9ChJfQdJYkaKiD9UsRi1mE";

export const ARGUS_URL = `${CLOUD_URL}/functions/v1/argus`;

function headersForToken(token: string): Record<string, string> {
  return {
    apikey: CLOUD_ANON,
    Authorization: `Bearer ${CLOUD_ANON}`,
    "x-app-token": token,
  };
}

export async function argusHeaders(): Promise<Record<string, string>> {
  return headersForToken(await operationalToken(supabase.auth));
}

function assertOperationalUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.origin !== CLOUD_URL || !["/functions/v1/argus", "/functions/v1/erp-mirror", "/functions/v1/mixed-cartons"].includes(parsed.pathname)) {
    throw new Error("Destinație neacceptată pentru sesiunea aplicației.");
  }
}

export async function argusEdgeFetch<T = any>(url: string, options: EdgeFetchOptions = {}): Promise<T> {
  assertOperationalUrl(url);
  return withOperationalSession(supabase.auth, token => edgeFetchJson<T>(url, {
    ...options, headers: { ...options.headers, ...headersForToken(token) },
  }));
}

/** Fetch adapter for AI streams and FormData; clone the original body before each attempt. */
export async function argusRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const original = new Request(input, init);
  assertOperationalUrl(original.url);
  return withOperationalResponse(supabase.auth, token => {
    const request = original.clone();
    const headers = new Headers(request.headers);
    for (const [key, value] of Object.entries(headersForToken(token))) headers.set(key, value);
    return fetch(new Request(request, { headers }));
  });
}

export async function argusFetch<T = any>(
  action: string,
  params: Record<string, string> = {},
  body?: unknown,
): Promise<T> {
  const qs = new URLSearchParams({ action, ...params });
  return argusEdgeFetch<T>(`${ARGUS_URL}?${qs}`, {
    method: body === undefined ? "GET" : "POST",
    body,
  });
}
